"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left: brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-paper-line bg-paper-card p-12 lg:flex">
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #5b7cfa, transparent)" }}
        />
        <p className="font-display text-2xl text-white">Learning Library</p>
        <div>
          <h1 className="font-display text-5xl leading-tight text-white">
            คลังเรียนรู้
            <br />
            ภายในองค์กร
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
            ดูวิดีโอและเอกสารของทีมได้ในที่เดียว
            ปลอดภัย เป็นส่วนตัว เข้าถึงเฉพาะสมาชิกที่ได้รับอนุญาต
          </p>
        </div>
        <p className="text-xs text-muted">เข้าถึงเฉพาะผู้ที่ได้รับสิทธิ์เท่านั้น</p>
      </div>

      {/* Right: form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <p className="font-display text-2xl text-white">Learning Library</p>
          </div>
          <h2 className="font-display text-3xl text-white">เข้าสู่ระบบ</h2>
          <p className="mt-2 text-sm text-muted">
            กรอกชื่อผู้ใช้และรหัสผ่านที่ผู้ดูแลระบบให้ไว้
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-muted">ชื่อผู้ใช้</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="w-full rounded-lg border border-paper-line bg-paper px-3.5 py-2.5 text-white outline-none transition-colors focus:border-accent"
                placeholder="username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted">รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-paper-line bg-paper px-3.5 py-2.5 text-white outline-none transition-colors focus:border-accent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {submitting ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
