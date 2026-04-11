import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/* Admin sub-header — replaces the need for the regular nav context */}
      <div className="mb-6 flex items-center gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to App
        </Link>
        <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Admin Panel</span>
      </div>
      {children}
    </div>
  );
}
