"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import FolderBrowser from "@/components/FolderBrowser";
import { useAuth } from "@/lib/auth-context";
import { getFolder } from "@/lib/api";
import type { FolderView } from "@/types";

function CourseDetailInner() {
  const params = useParams();
  const { user } = useAuth();
  const slug = String(params.slug);

  const [view, setView] = useState<FolderView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getFolder(slug, user.token)
      .then(setView)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, slug]);

  return (
    <div>
      <Link
        href="/courses"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
      >
        ← กลับไปคอร์สเรียน
      </Link>

      <header className="mb-8 flex items-center gap-3">
        <span className="text-3xl">📁</span>
        <div>
          <h1 className="font-display text-4xl text-white">{view?.name ?? "…"}</h1>
          {view && (
            <p className="mt-1 text-sm text-muted">
              {view.folders.length > 0 && `${view.folders.length} โฟลเดอร์`}
              {view.folders.length > 0 && view.items.length > 0 && " · "}
              {view.items.length > 0 && `${view.items.length} ไฟล์`}
            </p>
          )}
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted">กำลังโหลด…</p>
      ) : view ? (
        <FolderBrowser view={view} />
      ) : null}
    </div>
  );
}

export default function CourseDetailPage() {
  return (
    <RequireAuth>
      <AppShell>
        <CourseDetailInner />
      </AppShell>
    </RequireAuth>
  );
}
