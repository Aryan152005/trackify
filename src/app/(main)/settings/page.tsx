import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  User, Bell, Briefcase, Users, Plug, AlertTriangle, ChevronRight, Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tiles: {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    tone: string;
  }[] = [
    {
      href: "/settings/profile",
      icon: User,
      title: "Profile",
      description: "Your name, avatar, email. Signed in as " + (user.email ?? "unknown"),
      tone: "from-indigo-500 to-blue-500",
    },
    {
      href: "/reminders",
      icon: Bell,
      title: "Notifications",
      description: "Enable push, manage devices, test cross-device delivery.",
      tone: "from-amber-500 to-orange-500",
    },
    {
      href: "/workspace",
      icon: Briefcase,
      title: "Workspace",
      description: "Rename, update description, and workspace-level settings.",
      tone: "from-emerald-500 to-teal-500",
    },
    {
      href: "/workspace/members",
      icon: Users,
      title: "Team Members",
      description: "Invite teammates, manage roles, review pending invitations.",
      tone: "from-sky-500 to-indigo-500",
    },
    {
      href: "/help?tour=1",
      icon: Sparkles,
      title: "Walkthrough",
      description: "Take the 2-minute tour through every feature again.",
      tone: "from-purple-500 to-pink-500",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your profile, notifications, workspace, and team — all in one place."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href}>
              <Card className="group h-full p-4 transition hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-700">
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${t.tone} text-white shadow-sm`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t.title}</h3>
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t.description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Placeholder for future sections */}
      <Card className="border-dashed p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Integrations</h3>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Connect external services (Google Calendar, Slack, etc.) — coming soon.
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-red-200 bg-red-50/40 p-5 dark:border-red-900/40 dark:bg-red-950/10">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">Danger zone</h3>
            <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-400/80">
              Account deletion and workspace transfer will live here. Contact the admin for now.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
