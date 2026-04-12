import { AppNav } from "@/components/app-nav";
import { WorkspaceProvider } from "@/lib/workspace/context";
import { PresenceProvider } from "@/lib/realtime/presence-provider";
import { ReminderNotifier } from "@/components/reminders/reminder-notifier";
import { PageTransition } from "@/components/ui/page-transition";
import { isCurrentUserAdmin } from "@/lib/admin/actions";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await isCurrentUserAdmin();
  return (
    <WorkspaceProvider>
      <PresenceProvider>
        <AppNav isAdmin={isAdmin} />
        <ReminderNotifier />
        <main className="w-full px-4 py-5 sm:px-6 sm:py-8 lg:px-10 xl:px-14 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
          <PageTransition>{children}</PageTransition>
        </main>
      </PresenceProvider>
    </WorkspaceProvider>
  );
}
