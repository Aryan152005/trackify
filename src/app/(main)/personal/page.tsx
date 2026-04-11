import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { getPersonalStats } from "@/lib/personal/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileText,
  CheckSquare,
  BookOpen,
  Columns3,
  Bell,
  Lock,
  ShieldCheck,
} from "lucide-react";

export default async function PersonalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/onboarding");

  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Personal Space
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Please select or create a workspace first.
          </p>
        </div>
      </div>
    );
  }

  const stats = await getPersonalStats(workspaceId);

  const quickLinks = [
    {
      href: "/personal/pages",
      label: "My Pages",
      count: stats.privatePages,
      icon: FileText,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      href: "/personal/tasks",
      label: "My Tasks",
      count: stats.privateTasks.total,
      icon: CheckSquare,
      color: "text-green-500",
      bg: "bg-green-50 dark:bg-green-950",
    },
    {
      href: "/personal/entries",
      label: "My Entries",
      count: stats.privateEntries,
      icon: BookOpen,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-950",
    },
    {
      href: "/personal/boards",
      label: "My Boards",
      count: stats.privateBoards,
      icon: Columns3,
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950",
    },
    {
      href: "/personal/reminders",
      label: "My Reminders",
      count: stats.privateReminders,
      icon: Bell,
      color: "text-pink-500",
      bg: "bg-pink-50 dark:bg-pink-950",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Welcome, {profile.name}
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Your personal space — private items only you can see
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {quickLinks.map(({ href, label, count, icon: Icon, color, bg }) => (
          <Link key={href} href={href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg}`}
                >
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {count}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {label}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Task breakdown */}
      {stats.privateTasks.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Private Tasks Breakdown</CardTitle>
            <CardDescription>Status of your private tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">
                  {stats.privateTasks.pending}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Pending
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {stats.privateTasks.inProgress}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  In Progress
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {stats.privateTasks.done}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Done
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            How Private Items Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>
              Use the <strong>Private toggle</strong> (lock icon) on any page,
              task, entry, board, or reminder to make it visible only to you.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>
              Private items are hidden from all other workspace members,
              including admins and owners.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>
              You can toggle privacy on and off at any time. Making an item
              public again restores normal workspace visibility.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
