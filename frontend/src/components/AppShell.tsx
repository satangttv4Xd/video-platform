"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const nav = [
  { href: "/dashboard", label: "ภาพรวม", icon: "◈" },
  { href: "/courses", label: "คอร์สเรียน", icon: "▤" },
  { href: "/videos", label: "วิดีโอ", icon: "▷" },
  { href: "/documents", label: "เอกสาร", icon: "❖" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-paper-line bg-paper-card px-5 py-7 md:flex">
        <div className="mb-9 px-2">
          <p className="font-display text-xl leading-tight text-white">
            Learning
            <br />
            Library
          </p>
          <p className="mt-1 text-xs text-muted">คลังเรียนรู้ภายในองค์กร</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-accent-soft text-white"
                    : "text-muted hover:bg-paper-line hover:text-white"
                }`}
              >
                <span className="w-4 text-center opacity-80">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}

          {user?.role === "admin" && (
            <Link
              href="/admin"
              className={`mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-accent-soft text-white"
                  : "text-muted hover:bg-paper-line hover:text-white"
              }`}
            >
              <span className="w-4 text-center opacity-80">⚙</span>
              ผู้ดูแลระบบ
            </Link>
          )}
        </nav>

        <div className="mt-4 border-t border-paper-line pt-4">
          <div className="mb-3 px-2">
            <p className="text-sm text-white">{user?.username}</p>
            <p className="text-xs text-muted">
              {user?.role === "admin" ? "ผู้ดูแลระบบ" : "สมาชิก"}
            </p>
          </div>
          <button
            onClick={logout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-paper-line hover:text-white"
          >
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-10 flex items-center justify-between border-b border-paper-line bg-paper-card px-4 py-3 md:hidden">
        <span className="font-display text-lg text-white">Learning Library</span>
        <button onClick={logout} className="text-sm text-muted">
          ออก
        </button>
      </div>

      {/* Mobile nav */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-paper-line bg-paper-card py-2 md:hidden">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
              pathname.startsWith(item.href) ? "text-white" : "text-muted"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
        {user?.role === "admin" && (
          <Link
            href="/admin"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
              pathname.startsWith("/admin") ? "text-white" : "text-muted"
            }`}
          >
            <span>⚙</span>
            แอดมิน
          </Link>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 px-5 pb-24 pt-20 md:ml-64 md:px-10 md:pb-10 md:pt-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
