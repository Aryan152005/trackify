import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInbox } from "@/lib/inbox/actions";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AtSign,
  ClipboardList,
  AlertTriangle,
  Mail,
  MessageSquare,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { formatIST } from "@/lib/utils/datetime";
import { formatDistanceToNow } from "date-fns";

function relative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const snap = await getInbox();

  if (snap.total === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Inbox"
          description="Everything waiting on you — in one pile."
        />
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="Inbox zero"
          description="Nothing needs your attention right now."
          hint="When teammates @-mention you, assign tasks, send invites, or reminders go overdue, they'll land here so you can clear them in one sweep."
          actionLabel="Plan today instead"
          actionHref="/today"
          secondaryLabel="Capture a new todo"
          secondaryHref="/tasks/new"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Inbox"
        description={`${snap.total} item${snap.total === 1 ? "" : "s"} waiting on you.`}
      />

      {/* Mentions — highest priority: someone asked for you by name */}
      <Section
        icon={<AtSign className="h-4 w-4 text-purple-500" />}
        title="You were mentioned"
        subtitle="Unread @-mentions across every workspace."
        count={snap.mentions.length}
        tone="purple"
      >
        {snap.mentions.map((m) => (
          <Row
            key={m.id}
            href="/mentions"
            title={m.title}
            subtitle={m.body ?? undefined}
            meta={relative(m.created_at)}
          />
        ))}
      </Section>

      {/* Tasks assigned to me */}
      <Section
        icon={<ClipboardList className="h-4 w-4 text-indigo-500" />}
        title="Assigned to you"
        subtitle="Open tasks with your name on them."
        count={snap.assigned.length}
        tone="indigo"
      >
        {snap.assigned.map((t) => (
          <Row
            key={t.id}
            href={`/tasks/${t.id}`}
            title={t.title}
            subtitle={t.status}
            chip={t.priority ?? undefined}
            chipTone={
              t.priority === "urgent" || t.priority === "high" ? "red" : "default"
            }
            meta={t.due_date ? `Due ${formatIST(t.due_date + "T00:00:00Z", { month: "short", day: "numeric" })}` : undefined}
          />
        ))}
      </Section>

      {/* Overdue reminders */}
      <Section
        icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
        title="Overdue reminders"
        subtitle="Past their scheduled time and not yet completed."
        count={snap.overdue.length}
        tone="red"
      >
        {snap.overdue.map((r) => (
          <Row
            key={r.id}
            href="/reminders"
            title={r.title}
            meta={`Due ${relative(r.reminder_time)}`}
            metaTone="red"
          />
        ))}
      </Section>

      {/* Workspace invites */}
      <Section
        icon={<Mail className="h-4 w-4 text-emerald-500" />}
        title="Workspace invitations"
        subtitle="Teams you've been invited to join."
        count={snap.invites.length}
        tone="emerald"
      >
        {snap.invites.map((inv) => (
          <Row
            key={inv.id}
            href={`/api/workspace/invite/accept?token=${inv.token}`}
            title={`Join "${inv.workspace_name}" as ${inv.role}`}
            subtitle={inv.inviter_email ? `Invited by ${inv.inviter_email}` : undefined}
            actionLabel="Open"
          />
        ))}
      </Section>

      {/* Pending requests */}
      <Section
        icon={<MessageSquare className="h-4 w-4 text-amber-500" />}
        title="Requests"
        subtitle="Teammates waiting for your reply."
        count={snap.requests.length}
        tone="amber"
      >
        {snap.requests.map((r) => (
          <Row
            key={r.id}
            href="/requests"
            title={r.title}
            subtitle={r.description ?? `${r.type} · from ${r.from_name}`}
            meta={relative(r.created_at)}
          />
        ))}
      </Section>

      <p className="pt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
        Pro tip — clear this page daily. Empty inbox = everything's running without you.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────

type Tone = "purple" | "indigo" | "red" | "emerald" | "amber" | "default";

function Section({
  icon,
  title,
  subtitle,
  count,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  tone: Tone;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  const countTone: Record<Tone, string> = {
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    default: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${countTone[tone]}`}>
          {count}
        </span>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {children}
      </ul>
    </section>
  );
}

function Row({
  href,
  title,
  subtitle,
  chip,
  chipTone = "default",
  meta,
  metaTone = "default",
  actionLabel,
}: {
  href: string;
  title: string;
  subtitle?: string;
  chip?: string;
  chipTone?: "red" | "default";
  meta?: string;
  metaTone?: "red" | "default";
  actionLabel?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-start gap-3 px-3 py-2.5 text-sm transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate font-medium text-zinc-900 dark:text-zinc-50">
              {title}
            </p>
            {chip && (
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                  chipTone === "red"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {chip}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta && (
            <span
              className={`text-[11px] tabular-nums ${
                metaTone === "red"
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {meta}
            </span>
          )}
          {actionLabel && (
            <span className="inline-flex items-center gap-0.5 rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              {actionLabel}
            </span>
          )}
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400" />
        </div>
      </Link>
    </li>
  );
}

