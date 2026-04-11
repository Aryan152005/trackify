"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LayoutDashboard,
  User,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

const navSections = [
  {
    label: "Main",
    items: [
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
    ],
  },
  {
    label: "Collaborate",
    items: [
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
    ],
  },
  {
    label: "",
    items: [
      { href: "/workspace", label: "Workspace Settings", icon: Settings },
      { href: "/help", label: "Help & Guide", icon: HelpCircle },
      { href: "/feedback", label: "Send Feedback", icon: Star },
    ],
  },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const close = useCallback(() => setOpen(false), []);

  // Close on route change
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label="Toggle menu"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={close}
        aria-hidden
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-white shadow-2xl transition-transform duration-200 ease-out dark:bg-zinc-900 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
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

        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:hidden">
          <WorkspaceSwitcher />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {navSections.map((section, si) => (
            <div key={si} className={cn(si > 0 && "mt-4")}>
              {section.label && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {section.label}
                </p>
              )}
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    )}
                  >
                    <Icon className={cn("h-4.5 w-4.5 shrink-0", active ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500")} />
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
