"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/lib/auth-context";
import { documentUrl, getDocuments } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";
import type { DocumentItem } from "@/types";

function DocumentsInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDocuments(user.token)
      .then((data) => {
        setDocs(data);
        const openId = Number(searchParams.get("open"));
        if (openId) {
          const found = data.find((d) => d.id === openId);
          if (found) setSelected(found);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, searchParams]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-4xl text-white">คลังเอกสาร</h1>
        <p className="mt-1 text-sm text-muted">
          {docs.length > 0 ? `${docs.length} ไฟล์ PDF` : "เอกสารสำหรับอ่านในองค์กร"}
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* List */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-muted">กำลังโหลด…</p>
          ) : docs.length === 0 ? (
            <div className="rounded-card border border-dashed border-paper-line px-4 py-10 text-center text-sm text-muted">
              ยังไม่มีเอกสารในระบบ
            </div>
          ) : (
            docs.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelected(d)}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  selected?.id === d.id
                    ? "border-accent bg-accent-soft"
                    : "border-paper-line bg-paper-card hover:border-accent/40"
                }`}
              >
                <span className="mt-0.5 text-lg text-red-300">❖</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">
                    {d.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {formatDate(d.created_at)} · {formatBytes(d.size)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        {/* Viewer */}
        <div className="min-h-[70vh] overflow-hidden rounded-card border border-paper-line bg-paper-card">
          {selected && user ? (
            <iframe
              key={selected.id}
              src={documentUrl(selected.id, user.token)}
              title={selected.title}
              className="h-full min-h-[70vh] w-full"
            />
          ) : (
            <div className="flex min-h-[70vh] items-center justify-center text-center">
              <div>
                <p className="text-4xl text-paper-line">❖</p>
                <p className="mt-3 text-sm text-muted">
                  เลือกเอกสารทางซ้ายเพื่อเปิดอ่าน
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<p className="text-muted">กำลังโหลด…</p>}>
          <DocumentsInner />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}
