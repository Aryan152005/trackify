import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  User,
  Briefcase,
  Users,
  Plug,
  Link2,
  ChevronRight,
  Palette,
  HelpCircle,
  Shield,
  LogOut,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

interface Tile {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

interface Section {
  title: string;
  subtitle: string;
  tiles: Tile[];
}

/**
 * Settings hub — reorganised into 3 sections so users don't have to
 * scan six rainbow tiles to find "change my landing page". Sections
 * map to the three scopes a user actually thinks about:
 *   1. Account — what's mine (profile, session)
 *   2. Preferences — how the app behaves (landing, density, accent…)
 *   3. Workspace — what's the team's (members, integrations, shared
 *      links audit)
 *
 * A separate "help" section covers the walkthrough + support links
 * so they aren't mixed into the above.
 */
export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sections: Section[] = [
    {
      title: "Account",
      subtitle: "Profile and session settings that belong to you.",
      tiles: [
        {
          href: "/settings/profile",
          icon: User,
          title: "Profile",
          description: "Name, avatar, email. Signed in as " + (user.email ?? "unknown") + ".",
        },
      ],
    },
    {
      title: "Preferences",
      subtitle: "How the app looks and where it takes you.",
      tiles: [
        {
          href: "/settings/preferences",
          icon: Palette,
          title: "Appearance & defaults",
          description:
            "Landing page, density, accent colour, quick-capture button, default task view.",
        },
      ],
    },
    {
      title: "Workspace",
      subtitle: "Shared with your team. Only admins can change some of these.",
      tiles: [
        {
          href: "/workspace",
          icon: Briefcase,
          title: "Workspace settings",
          description: "Rename, change description, danger-zone controls.",
        },
        {
          href: "/workspace/members",
          icon: Users,
          title: "Team members",
          description: "Invite teammates, manage roles, review pending invitations.",
        },
        {
          href: "/workspace/integrations",
          icon: Plug,
          title: "Integrations",
          description: "Incoming + outgoing webhooks for external services.",
        },
        {
          href: "/workspace/shared-links",
          icon: Link2,
          title: "Shared links audit",
          description: "Every public link from this workspace, with visit stats + revoke.",
        },
      ],
    },
    {
      title: "Help",
      subtitle: "Getting unstuck.",
      tiles: [
        {
          href: "/help?tour=1",
          icon: HelpCircle,
          title: "Restart the walkthrough",
          description: "Take the 2-minute tour again — covers capture, tasks, collab, sharing.",
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title="Settings"
        description="Change how Trackify looks, behaves, and shares with your team."
      />

      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {section.title}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
              {section.subtitle}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.tiles.map((t) => {
              const Icon = t.icon;
              return (
                <Link key={t.href} href={t.href}>
                  <Card className="group h-full p-4 transition hover:border-indigo-300 hover:shadow-sm dark:hover:border-indigo-700">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            {t.title}
                          </h3>
                          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {t.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {/* Session footer — sign-out hint. The actual sign-out lives in the
          header for one-click reach; this row just tells the user where
          to find it without making them hunt. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Session
        </h2>
        <Card className="border-dashed p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <LogOut className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Sign out</h3>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Click the logout icon in the top-right of the header on any page.
              </p>
            </div>
            <Shield className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
          </div>
        </Card>
      </section>
    </div>
  );
}
