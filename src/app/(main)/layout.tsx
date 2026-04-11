import { AppNav } from "@/components/app-nav";
import { WorkspaceProvider } from "@/lib/workspace/context";
import { PresenceProvider } from "@/lib/realtime/presence-provider";
import { ReminderNotifier } from "@/components/reminders/reminder-notifier";

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
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </PresenceProvider>
    </WorkspaceProvider>
  );
}
