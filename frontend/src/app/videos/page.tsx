"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { getVideos } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";
import type { Video } from "@/types";

function VideosInner() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getVideos(user.token)
      .then(setVideos)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-4xl text-white">คลังวิดีโอ</h1>
        <p className="mt-1 text-sm text-muted">
          {videos.length > 0 ? `${videos.length} รายการ` : "เลือกวิดีโอเพื่อเริ่มชม"}
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted">กำลังโหลด…</p>
      ) : videos.length === 0 ? (
        <div className="rounded-card border border-dashed border-paper-line px-6 py-16 text-center">
          <p className="text-muted">ยังไม่มีวิดีโอในระบบ</p>
          <p className="mt-1 text-sm text-muted">
            ผู้ดูแลระบบต้องซิงก์ข้อมูลจาก Google Drive ก่อน
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <Link
              key={v.id}
              href={`/videos/${v.id}`}
              className="group overflow-hidden rounded-card border border-paper-line bg-paper-card transition-colors hover:border-accent/50"
            >
              <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-paper">
                {v.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.thumbnail}
                    alt={v.title}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-4xl text-paper-line">▷</span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-ink">
                    ▶
                  </span>
                </span>
              </div>
              <div className="p-4">
                <h3 className="truncate font-medium text-white">{v.title}</h3>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
                  <span>{formatDate(v.created_at)}</span>
                  <span>·</span>
                  <span>{formatBytes(v.size)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VideosPage() {
  return (
    <RequireAuth>
      <AppShell>
        <VideosInner />
      </AppShell>
    </RequireAuth>
  );
}
