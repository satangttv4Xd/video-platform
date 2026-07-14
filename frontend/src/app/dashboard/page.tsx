"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { getDashboard } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { DashboardStats } from "@/types";

function DashboardInner() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    getDashboard(user.token)
      .then(setStats)
      .catch((e) => setError(e.message));
  }, [user]);

  return (
    <div>
      <header className="mb-8">
        <p className="text-sm text-muted">ยินดีต้อนรับกลับมา</p>
        <h1 className="font-display text-4xl text-white">{user?.username}</h1>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/videos"
          className="group rounded-card border border-paper-line bg-paper-card p-6 transition-colors hover:border-accent/50"
        >
          <p className="text-sm text-muted">วิดีโอทั้งหมด</p>
          <p className="mt-2 font-display text-5xl text-white">
            {stats?.video_count ?? "—"}
          </p>
          <p className="mt-3 text-sm text-accent opacity-0 transition-opacity group-hover:opacity-100">
            ดูคลังวิดีโอ →
          </p>
        </Link>
        <Link
          href="/documents"
          className="group rounded-card border border-paper-line bg-paper-card p-6 transition-colors hover:border-accent/50"
        >
          <p className="text-sm text-muted">เอกสาร PDF</p>
          <p className="mt-2 font-display text-5xl text-white">
            {stats?.document_count ?? "—"}
          </p>
          <p className="mt-3 text-sm text-accent opacity-0 transition-opacity group-hover:opacity-100">
            ดูคลังเอกสาร →
          </p>
        </Link>
      </div>

      {/* Recent lists */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
            วิดีโอล่าสุด
          </h2>
          <div className="space-y-2">
            {stats?.recent_videos.length ? (
              stats.recent_videos.map((v) => (
                <Link
                  key={v.id}
                  href={`/videos/${v.id}`}
                  className="flex items-center justify-between rounded-lg border border-paper-line bg-paper-card px-4 py-3 transition-colors hover:border-accent/40"
                >
                  <span className="truncate text-sm text-white">{v.title}</span>
                  <span className="ml-3 shrink-0 text-xs text-muted">
                    {formatDate(v.created_at)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-paper-line px-4 py-6 text-center text-sm text-muted">
                ยังไม่มีวิดีโอ
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
            เอกสารล่าสุด
          </h2>
          <div className="space-y-2">
            {stats?.recent_documents.length ? (
              stats.recent_documents.map((d) => (
                <Link
                  key={d.id}
                  href={`/documents?open=${d.id}`}
                  className="flex items-center justify-between rounded-lg border border-paper-line bg-paper-card px-4 py-3 transition-colors hover:border-accent/40"
                >
                  <span className="truncate text-sm text-white">{d.title}</span>
                  <span className="ml-3 shrink-0 text-xs text-muted">
                    {formatDate(d.created_at)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-paper-line px-4 py-6 text-center text-sm text-muted">
                ยังไม่มีเอกสาร
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <AppShell>
        <DashboardInner />
      </AppShell>
    </RequireAuth>
  );
}
