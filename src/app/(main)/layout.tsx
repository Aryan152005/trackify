import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { WorkspaceProvider } from "@/lib/workspace/context";
import { PresenceProvider } from "@/lib/realtime/presence-provider";
import { ReminderNotifier } from "@/components/reminders/reminder-notifier";
import { PageTransition } from "@/components/ui/page-transition";
import { RouteProgress } from "@/components/ui/route-progress";
import { PushKeepAlive } from "@/components/push/push-keep-alive";
import { PushPromptBanner } from "@/components/push/push-prompt-banner";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
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
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <AppNav isAdmin={isAdmin} />
        <PushPromptBanner />
        <ReminderNotifier />
        <PushKeepAlive />
        <WelcomeTour />
        <main className="w-full px-4 py-5 sm:px-6 sm:py-8 lg:px-10 xl:px-14 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
          <PageTransition>{children}</PageTransition>
        </main>
      </PresenceProvider>
    </WorkspaceProvider>
  );
}
