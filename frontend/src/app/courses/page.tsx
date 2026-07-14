"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import FolderBrowser from "@/components/FolderBrowser";
import { useAuth } from "@/lib/auth-context";
import { getCoursesRoot } from "@/lib/api";
import type { FolderView } from "@/types";

function CoursesInner() {
  const { user } = useAuth();
  const [view, setView] = useState<FolderView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getCoursesRoot(user.token)
      .then(setView)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-4xl text-white">คอร์สเรียน</h1>
        <p className="mt-1 text-sm text-muted">
          เลือกหัวข้อเพื่อเปิดดูไฟล์ · กดที่ไฟล์เพื่ออ่าน/ดูได้เลย
        </p>
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

export default function CoursesPage() {
  return (
    <RequireAuth>
      <AppShell>
        <CoursesInner />
      </AppShell>
    </RequireAuth>
  );
}
