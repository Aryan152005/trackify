"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Puzzle,
  PlugZap,
  Webhook,
  ScrollText,
  XCircle,
} from "lucide-react";
import { useRequireRole } from "@/lib/workspace/hooks";
import { AnimatedPage } from "@/components/ui/animated-layout";
import { IntegrationHub } from "@/components/integrations/integration-hub";
import { WebhookManager } from "@/components/integrations/webhook-manager";
import { IntegrationLogs } from "@/components/integrations/integration-logs";
import { cn } from "@/lib/utils";

type Tab = "connected" | "webhooks" | "logs";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "connected", label: "Integrations", icon: PlugZap },
  { key: "webhooks", label: "Webhooks", icon: Webhook },
  { key: "logs", label: "Logs", icon: ScrollText },
];

export default function IntegrationsPage() {
  const isAdmin = useRequireRole("admin");
  const [activeTab, setActiveTab] = useState<Tab>("connected");
  const [logFilterIntegrationId, setLogFilterIntegrationId] = useState<
    string | null
  >(null);

  function handleViewLogs(integrationId: string) {
    setLogFilterIntegrationId(integrationId);
    setActiveTab("logs");
  }

  if (!isAdmin) {
    return (
      <AnimatedPage>
        <div className="flex flex-col items-center justify-center py-20">
          <XCircle className="mb-3 h-10 w-10 text-red-400" />
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Access Denied
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Only workspace admins can manage integrations.
          </p>
          <Link
            href="/workspace"
            className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            Back to Workspace
          </Link>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/workspace"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Workspace
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
          <Puzzle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Integrations
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Connect external services and manage webhooks for your workspace.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/50">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setActiveTab(key);
              if (key !== "logs") setLogFilterIntegrationId(null);
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
              activeTab === key
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "connected" && (
        <IntegrationHub onViewLogs={handleViewLogs} />
      )}
      {activeTab === "webhooks" && <WebhookManager />}
      {activeTab === "logs" && (
        <IntegrationLogs integrationId={logFilterIntegrationId} />
      )}
    </AnimatedPage>
  );
}
