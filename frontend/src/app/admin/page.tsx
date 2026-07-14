"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import {
  createUser,
  deleteUser,
  getDriveStatus,
  getGoogleAuthUrl,
  getUsers,
  resetPassword,
  syncDrive,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { DriveStatus, ManagedUser, Role, SyncResult } from "@/types";

function Banner({
  kind,
  children,
}: {
  kind: "ok" | "error";
  children: React.ReactNode;
}) {
  const cls =
    kind === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : "border-red-500/30 bg-red-500/10 text-red-300";
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>
  );
}

function AdminInner() {
  const { user } = useAuth();
  const token = user!.token;
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [drive, setDrive] = useState<DriveStatus | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null
  );

  // new-user form
  const [nu, setNu] = useState({ username: "", password: "", role: "member" as Role });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [u, d] = await Promise.all([getUsers(token), getDriveStatus(token)]);
      setUsers(u);
      setDrive(d);
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "error" });
    }
  }, [token]);

  useEffect(() => {
    refresh();
    if (searchParams.get("google") === "connected") {
      setMsg({ kind: "ok", text: "เชื่อมต่อ Google Drive สำเร็จแล้ว" });
    }
  }, [refresh, searchParams]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await createUser(nu, token);
      setNu({ username: "", password: "", role: "member" });
      setMsg({ kind: "ok", text: `เพิ่มผู้ใช้ "${nu.username}" แล้ว` });
      refresh();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number, username: string) {
    if (!confirm(`ลบผู้ใช้ "${username}" ?`)) return;
    try {
      await deleteUser(id, token);
      setMsg({ kind: "ok", text: `ลบผู้ใช้ "${username}" แล้ว` });
      refresh();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "error" });
    }
  }

  async function handleReset(id: number, username: string) {
    const pw = prompt(`ตั้งรหัสผ่านใหม่สำหรับ "${username}"`);
    if (!pw) return;
    try {
      await resetPassword(id, pw, token);
      setMsg({ kind: "ok", text: `รีเซ็ตรหัสผ่านของ "${username}" แล้ว` });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "error" });
    }
  }

  async function handleConnectGoogle() {
    try {
      const { authorization_url } = await getGoogleAuthUrl(token);
      window.location.href = authorization_url;
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "error" });
    }
  }

  async function handleSync() {
    setBusy(true);
    setMsg(null);
    try {
      const r: SyncResult = await syncDrive(token);
      setMsg({
        kind: "ok",
        text: `ซิงก์สำเร็จ — วิดีโอใหม่ ${r.videos_added}, เอกสารใหม่ ${r.documents_added} (รวมวิดีโอ ${r.videos_total}, เอกสาร ${r.documents_total})`,
      });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-4xl text-white">ผู้ดูแลระบบ</h1>
        <p className="mt-1 text-sm text-muted">
          จัดการผู้ใช้และการเชื่อมต่อ Google Drive
        </p>
      </header>

      {msg && (
        <div className="mb-6">
          <Banner kind={msg.kind}>{msg.text}</Banner>
        </div>
      )}

      {/* Google Drive */}
      <section className="mb-10 rounded-card border border-paper-line bg-paper-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl text-white">Google Drive</h2>
            <p className="mt-1 text-sm text-muted">
              เชื่อมต่อบัญชีเจ้าของไฟล์ แล้วซิงก์รายการวิดีโอและเอกสาร
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs ${
              drive?.connected
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-paper-line text-muted"
            }`}
          >
            {drive?.connected ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ"}
          </span>
        </div>

        {drive?.connected && (
          <div className="mb-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-paper-line bg-paper px-4 py-3">
              <p className="text-muted">Refresh token</p>
              <p className="mt-0.5 text-white">
                {drive.has_refresh_token ? "มี (ต่ออายุอัตโนมัติ)" : "ไม่มี"}
              </p>
            </div>
            <div className="rounded-lg border border-paper-line bg-paper px-4 py-3">
              <p className="text-muted">Access token หมดอายุ</p>
              <p className="mt-0.5 text-white">
                {drive.expires_at
                  ? new Date(drive.expires_at).toLocaleString("th-TH")
                  : "—"}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleConnectGoogle}
            className="rounded-lg border border-paper-line bg-paper px-4 py-2.5 text-sm text-white transition-colors hover:border-accent"
          >
            {drive?.connected ? "เชื่อมต่อใหม่" : "เชื่อมต่อ Google Drive"}
          </button>
          <button
            onClick={handleSync}
            disabled={busy || !drive?.connected}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? "กำลังซิงก์…" : "ซิงก์ไฟล์"}
          </button>
        </div>
      </section>

      {/* User management */}
      <section className="rounded-card border border-paper-line bg-paper-card p-6">
        <h2 className="font-display text-2xl text-white">จัดการผู้ใช้</h2>
        <p className="mt-1 text-sm text-muted">
          เพิ่ม ลบ หรือรีเซ็ตรหัสผ่านของสมาชิก
        </p>

        {/* Add user form */}
        <form
          onSubmit={handleCreate}
          className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"
        >
          <input
            required
            placeholder="ชื่อผู้ใช้"
            value={nu.username}
            onChange={(e) => setNu({ ...nu, username: e.target.value })}
            className="rounded-lg border border-paper-line bg-paper px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent"
          />
          <input
            required
            type="text"
            placeholder="รหัสผ่าน"
            value={nu.password}
            onChange={(e) => setNu({ ...nu, password: e.target.value })}
            className="rounded-lg border border-paper-line bg-paper px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent"
          />
          <select
            value={nu.role}
            onChange={(e) => setNu({ ...nu, role: e.target.value as Role })}
            className="rounded-lg border border-paper-line bg-paper px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent"
          >
            <option value="member">สมาชิก</option>
            <option value="admin">ผู้ดูแลระบบ</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            เพิ่ม
          </button>
        </form>

        {/* User table */}
        <div className="mt-6 overflow-hidden rounded-lg border border-paper-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">ชื่อผู้ใช้</th>
                <th className="px-4 py-2.5 font-medium">สิทธิ์</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
                  สร้างเมื่อ
                </th>
                <th className="px-4 py-2.5 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-paper-line">
                  <td className="px-4 py-3 text-white">{u.username}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        u.role === "admin"
                          ? "bg-accent-soft text-accent"
                          : "bg-paper-line text-muted"
                      }`}
                    >
                      {u.role === "admin" ? "ผู้ดูแลระบบ" : "สมาชิก"}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleReset(u.id, u.username)}
                      className="mr-3 text-xs text-muted transition-colors hover:text-white"
                    >
                      รีเซ็ตรหัส
                    </button>
                    <button
                      onClick={() => handleDelete(u.id, u.username)}
                      className="text-xs text-red-400 transition-colors hover:text-red-300"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth adminOnly>
      <AppShell>
        <Suspense fallback={<p className="text-muted">กำลังโหลด…</p>}>
          <AdminInner />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}
