import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { requireAdmin } from "@/lib/admin/actions";
import { listPushRecipients, listPastBroadcasts } from "@/lib/admin/push-actions";
import { PageHeader } from "@/components/ui/page-header";
import { PushComposer } from "@/components/admin/push-composer";
import { BroadcastHistoryList } from "@/components/admin/broadcast-history-list";

export const dynamic = "force-dynamic";

export default async function AdminPushPage() {
  await requireAdmin();
  const [recipients, history] = await Promise.all([
    listPushRecipients(),
    listPastBroadcasts(25).catch(() => []),
  ]);

  const withPush = recipients.filter((r) => r.has_push).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </Link>
      </div>

      <PageHeader
        title="Send push notification"
        description={
          withPush === 0
            ? "Nobody has push enabled yet. Ask users to turn on notifications from Settings → Preferences first."
            : `Draft a message and send it to all, inactive users, or a picked group. ${withPush} of ${recipients.length} users currently have push enabled.`
        }
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            <Send className="h-3 w-3" />
            Admin Only
          </span>
        }
      />

      <PushComposer recipients={recipients} />

      {history.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Past broadcasts
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              Every send is logged. Expand a row to read reactions and comments left by users.
            </p>
          </div>
          <BroadcastHistoryList initial={history} />
        </div>
      )}
    </div>
  );
}
