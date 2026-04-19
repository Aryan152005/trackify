import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { requireAdmin } from "@/lib/admin/actions";
import { listPushRecipients } from "@/lib/admin/push-actions";
import { PageHeader } from "@/components/ui/page-header";
import { PushComposer } from "@/components/admin/push-composer";

export const dynamic = "force-dynamic";

export default async function AdminPushPage() {
  await requireAdmin();
  const recipients = await listPushRecipients();

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
            : `Draft a message and send it to all, one, or a picked group of users. ${withPush} of ${recipients.length} users currently have push enabled.`
        }
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            <Send className="h-3 w-3" />
            Admin Only
          </span>
        }
      />

      <PushComposer recipients={recipients} />
    </div>
  );
}
