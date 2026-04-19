"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pin, PinOff } from "lucide-react";
import { getPinnedNavItems, togglePinNavItem } from "@/lib/preferences/actions";
import {
  Menu,
  X,
  LayoutDashboard,
  User,
  Users,
  FileText,
  CheckSquare,
  Columns3,
  StickyNote,
  Brain,
  MessageSquare,
  Calendar,
  Ticket,
  Pencil,
  Bell,
  BarChart3,
  FileDown,
  Clock,
  Settings,
  HelpCircle,
  Star,
  Flame,
  Shield,
  Target,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

const navSections = [
  {
    label: "Main",
    items: [
      { href: "/today", label: "Today", icon: Sun },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/personal", label: "Personal", icon: User },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/entries", label: "Entries", icon: FileText },
      { href: "/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/boards", label: "Boards", icon: Columns3 },
      { href: "/notes", label: "Notes", icon: StickyNote },
      { href: "/mindmaps", label: "Mind Maps", icon: Brain },
    ],
  },
  {
    label: "Schedule",
    items: [
      { href: "/calendar", label: "Calendar", icon: Calendar },
      { href: "/reminders", label: "Reminders", icon: Bell },
      { href: "/timeline", label: "Timeline", icon: Clock },
      { href: "/challenges", label: "Challenges", icon: Target },
    ],
  },
  {
    label: "Collaborate",
    items: [
      { href: "/workspace/members", label: "Team Members", icon: Users },
      { href: "/workspace/activity", label: "Workspace Activity", icon: Flame },
      { href: "/requests", label: "Requests", icon: MessageSquare },
      { href: "/bookings", label: "Bookings", icon: Ticket },
      { href: "/drawings", label: "Drawings", icon: Pencil },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/reports", label: "Reports", icon: FileDown },
      { href: "/motivation", label: "Motivation", icon: Flame },
    ],
  },
  {
    label: "",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/help", label: "Help & Guide", icon: HelpCircle },
      { href: "/feedback", label: "Send Feedback", icon: Star },
    ],
  },
];

export function MobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState<string[]>([]);
  const pathname = usePathname();
  const sections = isAdmin
    ? [...navSections, {
        label: "Admin",
        items: [{ href: "/admin", label: "Admin Dashboard", icon: Shield }],
      }]
    : navSections;

  // Load pinned items on open (fresh each time so cross-tab edits land)
  useEffect(() => {
    if (!open) return;
    getPinnedNavItems().then(setPinned).catch(() => setPinned([]));
  }, [open]);

  async function handleTogglePin(href: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const prev = pinned;
    // Optimistic
    setPinned((p) => (p.includes(href) ? p.filter((h) => h !== href) : [...p, href]));
    try {
      const next = await togglePinNavItem(href);
      setPinned(next);
    } catch {
      setPinned(prev);
    }
  }

  // Collect all nav items to resolve pinned hrefs back to {href,label,icon}
  const allItems = sections.flatMap((s) => s.items);
  const pinnedResolved = pinned
    .map((href) => allItems.find((i) => i.href === href))
    .filter((i): i is NonNullable<typeof i> => !!i);

  const close = useCallback(() => setOpen(false), []);

  // Close on route change
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Lock body scroll when open (simple overflow:hidden — position:fixed broke drawer height on some devices)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className=" rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label="Toggle menu"
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={close}
        aria-hidden
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen h-[100dvh] w-72 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out dark:bg-zinc-900 ",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
          <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">Trackify</span>
          <button
            onClick={close}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <WorkspaceSwitcher />
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {/* Pinned section (user favorites) */}
          {pinnedResolved.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                <Pin className="h-3 w-3" />
                Pinned
              </p>
              {pinnedResolved.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <div key={"pin-" + href} className="group relative">
                    <Link
                      href={href}
                      onClick={close}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 pr-10 text-sm font-medium transition-colors",
                        active
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      )}
                    >
                      <Icon className={cn("h-4.5 w-4.5 shrink-0", active ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500")} />
                      {label}
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(href, e)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-indigo-500 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                      aria-label={`Unpin ${label}`}
                      title="Unpin"
                    >
                      <PinOff className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {sections.map((section, si) => (
            <div key={si} className={cn((si > 0 || pinnedResolved.length > 0) && "mt-4")}>
              {section.label && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {section.label}
                </p>
              )}
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                const isPinned = pinned.includes(href);
                return (
                  <div key={href} className="group relative">
                    <Link
                      href={href}
                      onClick={close}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 pr-10 text-sm font-medium transition-colors",
                        active
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      )}
                    >
                      <Icon className={cn("h-4.5 w-4.5 shrink-0", active ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500")} />
                      {label}
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(href, e)}
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 transition group-hover:opacity-100",
                        isPinned
                          ? "text-indigo-500 opacity-100 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                          : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      )}
                      aria-label={isPinned ? `Unpin ${label}` : `Pin ${label}`}
                      title={isPinned ? "Unpin" : "Pin to top"}
                    >
                      {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
