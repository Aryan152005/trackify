import { AppNav } from "@/components/app-nav";
import { WorkspaceProvider } from "@/lib/workspace/context";
import { PresenceProvider } from "@/lib/realtime/presence-provider";
import { ReminderNotifier } from "@/components/reminders/reminder-notifier";
import { PageTransition } from "@/components/ui/page-transition";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <PresenceProvider>
        <AppNav />
        <ReminderNotifier />
        <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
          <PageTransition>{children}</PageTransition>
        </main>
      </PresenceProvider>
    </WorkspaceProvider>
  );
}
