"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatBytes } from "@/lib/format";
import type { FolderView } from "@/types";

/**
 * Renders one Drive-style folder listing: subfolders first (navigate deeper),
 * then files (click a PDF to read, a video to watch — both open in-app).
 */
export default function FolderBrowser({ view }: { view: FolderView }) {
  const router = useRouter();
  const isEmpty = view.folders.length === 0 && view.items.length === 0;

  if (isEmpty) {
    return (
      <div className="rounded-card border border-dashed border-paper-line px-6 py-16 text-center">
        <p className="text-muted">โฟลเดอร์นี้ยังไม่มีไฟล์</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-paper-line">
      {view.folders.map((f) => (
        <Link
          key={f.slug}
          href={`/courses/${encodeURIComponent(f.slug)}`}
          className="flex w-full items-center gap-3 border-b border-paper-line bg-paper-card px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-paper-line"
        >
          <span className="w-5 shrink-0 text-center">📁</span>
          <span className="flex-1 truncate font-medium text-white">{f.name}</span>
          <span className="shrink-0 text-muted">›</span>
        </Link>
      ))}

      {view.items.map((item) => (
        <button
          key={`${item.type}-${item.id}`}
          onClick={() =>
            router.push(
              item.type === "video"
                ? `/videos/${item.id}`
                : `/documents?open=${item.id}`
            )
          }
          className="flex w-full items-center gap-3 border-b border-paper-line bg-paper-card px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-paper-line"
        >
          <span
            className={`w-5 shrink-0 text-center ${
              item.type === "video" ? "text-accent" : "text-red-400"
            }`}
          >
            {item.type === "video" ? "▷" : "❖"}
          </span>
          <span className="flex-1 truncate text-sm text-white">{item.name}</span>
          <span className="shrink-0 text-xs text-muted">{formatBytes(item.size)}</span>
          <span className="shrink-0 text-xs text-accent">
            {item.type === "video" ? "ดู" : "อ่าน"}
          </span>
        </button>
      ))}
    </div>
  );
}
