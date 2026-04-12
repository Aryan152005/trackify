"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { UserNavInfo } from "@/components/user-nav-info";
import { MobileNav } from "@/components/mobile-nav";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { MentionsPopover } from "@/components/collaboration/mentions-popover";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
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
  Shield,
  Users,
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
  { href: "/workspace/members", label: "Team Members", icon: Users },
  { href: "/workspace", label: "Workspace Settings", icon: Settings },
  { href: "/help", label: "Help & Guide", icon: HelpCircle },
  { href: "/feedback", label: "Feedback", icon: Star },
];

export const navItems = primaryNav;

export function AppNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const moreNavWithAdmin = isAdmin
    ? [{ href: "/admin", label: "Admin", icon: Shield }, ...moreNav]
    : moreNav;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isMoreActive = moreNavWithAdmin.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-zinc-800 dark:bg-zinc-900/80 dark:supports-[backdrop-filter]:bg-zinc-900/60">
      <div className="flex h-14 w-full items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-6">
        {/* Left: hamburger (mobile) + logo + workspace (desktop) */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <MobileNav isAdmin={isAdmin} />
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 text-lg font-bold text-indigo-600 dark:text-indigo-400">
            Trackify
          </Link>
          <div className="hidden min-w-0 max-w-[180px] lg:block xl:max-w-[220px]">
            <WorkspaceSwitcher />
          </div>
          <div className="hidden sm:block">
            <CommandPalette />
          </div>
        </div>

        {/* Center: primary nav — takes remaining space and scrolls if too many items */}
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {primaryNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-medium transition-colors xl:px-2.5 ${
                  active
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden xl:inline">{label}</span>
              </Link>
            );
          })}

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                title="More"
                className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-[13px] font-medium transition-colors xl:px-2.5 ${
                  isMoreActive
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                }`}
              >
                <MoreHorizontal className="h-4 w-4 shrink-0" />
                <span className="hidden xl:inline">More</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 w-52 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {moreNavWithAdmin.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <DropdownMenu.Item key={href} asChild>
                      <Link
                        href={href}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm outline-none transition-colors ${
                          active
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                            : "text-zinc-700 hover:bg-zinc-50 focus:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
                        }`}
                      >
                        <Icon className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                        {label}
                      </Link>
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </nav>
        {/* Right: utility icons + user */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <NotificationBell />
          <MentionsPopover />
          <div className="hidden lg:block">
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
