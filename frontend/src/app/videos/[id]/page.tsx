"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { getVideo, videoStreamUrl } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";
import type { Video } from "@/types";

function PlayerInner() {
  const { user } = useAuth();
  const params = useParams();
  const id = Number(params.id);
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || Number.isNaN(id)) return;
    getVideo(id, user.token)
      .then(setVideo)
      .catch((e) => setError(e.message));
  }, [user, id]);

  return (
    <div>
      <Link
        href="/videos"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
      >
        ← กลับไปคลังวิดีโอ
      </Link>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {video && user && (
        <>
          <div className="overflow-hidden rounded-card border border-paper-line bg-black">
            <video
              key={video.id}
              controls
              controlsList="nodownload"
              onContextMenu={(e) => e.preventDefault()}
              className="aspect-video w-full"
              poster={video.thumbnail ?? undefined}
            >
              <source src={videoStreamUrl(video.id, user.token)} />
              เบราว์เซอร์ของคุณไม่รองรับการเล่นวิดีโอ
            </video>
          </div>

          <div className="mt-5">
            <h1 className="font-display text-3xl text-white">{video.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>{formatDate(video.created_at)}</span>
              <span>·</span>
              <span>{formatBytes(video.size)}</span>
              {video.mime_type && (
                <>
                  <span>·</span>
                  <span className="rounded bg-paper-line px-2 py-0.5 text-xs">
                    {video.mime_type}
                  </span>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function VideoPlayerPage() {
  return (
    <RequireAuth>
      <AppShell>
        <PlayerInner />
      </AppShell>
    </RequireAuth>
  );
}
