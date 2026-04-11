"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { UserNavInfo } from "@/components/user-nav-info";
import { MobileNav } from "@/components/mobile-nav";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { MentionsPopover } from "@/components/collaboration/mentions-popover";
import dynamic from "next/dynamic";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Columns3,
  StickyNote,
  BarChart3,
  FileDown,
  Calendar,
  LogOut,
  MoreHorizontal,
  Brain,
  MessageSquare,
  Clock,
  Pencil,
  Bell,
  Settings,
  HelpCircle,
  Star,
} from "lucide-react";

const CommandPalette = dynamic(
  () => import("@/components/search/command-palette").then((m) => m.CommandPalette),
  { ssr: false }
);

const primaryNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/entries", label: "Entries", icon: FileText },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/boards", label: "Boards", icon: Columns3 },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: FileDown },
];

const moreNav = [
  { href: "/mindmaps", label: "Mind Maps", icon: Brain },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/drawings", label: "Drawings", icon: Pencil },
  { href: "/requests", label: "Requests", icon: MessageSquare },
  { href: "/help", label: "Help & Guide", icon: HelpCircle },
  { href: "/feedback", label: "Feedback", icon: Star },
  { href: "/workspace", label: "Settings", icon: Settings },
];

export const navItems = primaryNav;

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [moreOpen]);

  // Close on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isMoreActive = moreNav.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-zinc-800 dark:bg-zinc-900/80 dark:supports-[backdrop-filter]:bg-zinc-900/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <MobileNav />
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold text-indigo-600 dark:text-indigo-400">
            Trackify
          </Link>
          <div className="hidden sm:block">
            <WorkspaceSwitcher />
          </div>
          <CommandPalette />
        </div>
        <nav className="hidden items-center gap-0.5 lg:flex">
          {primaryNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}

          {/* More dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                isMoreActive
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              }`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              More
            </button>

            {moreOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {moreNav.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                          : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <Icon className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
        <div className="flex items-center gap-1.5">
          <NotificationBell />
          <MentionsPopover />
          <div className="hidden sm:block">
            <UserNavInfo />
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
