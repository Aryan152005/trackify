"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MessageSquare,
  Github,
  Webhook,
  Mail,
  Plus,
  Power,
  PowerOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import {
  getIntegrations,
  updateIntegration,
  deleteIntegration,
} from "@/lib/integrations/actions";
import { INTEGRATION_CATALOG, type Integration, type IntegrationType } from "@/lib/integrations/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IntegrationConfigDialog } from "./integration-config-dialog";
import { cn } from "@/lib/utils";

// Map icon names to Lucide components
const ICON_MAP: Record<string, React.ElementType> = {
  MessageSquare,
  Github,
  Webhook,
  Mail,
};

interface IntegrationHubProps {
  onViewLogs?: (integrationId: string) => void;
}

export function IntegrationHub({ onViewLogs }: IntegrationHubProps) {
  const workspaceId = useWorkspaceId();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configType, setConfigType] = useState<IntegrationType | null>(null);
  const [editingIntegration, setEditingIntegration] =
    useState<Integration | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await getIntegrations(workspaceId);
      setIntegrations(data);
    } catch {
      // handle error silently
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  function handleAddNew(type: IntegrationType) {
    setConfigType(type);
    setEditingIntegration(null);
    setConfigDialogOpen(true);
  }

  function handleEdit(integration: Integration) {
    setConfigType(integration.type as IntegrationType);
    setEditingIntegration(integration);
    setConfigDialogOpen(true);
  }

  async function handleToggle(integration: Integration) {
    setTogglingId(integration.id);
    try {
      const updated = await updateIntegration(integration.id, {
        is_active: !integration.is_active,
      });
      setIntegrations((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i))
      );
    } catch {
      // handle error
    }
    setTogglingId(null);
  }

  async function handleDelete(integrationId: string) {
    try {
      await deleteIntegration(integrationId);
      setIntegrations((prev) => prev.filter((i) => i.id !== integrationId));
    } catch {
      // handle error
    }
  }

  function handleSaved(integration: Integration) {
    setIntegrations((prev) => {
      const exists = prev.find((i) => i.id === integration.id);
      if (exists) {
        return prev.map((i) => (i.id === integration.id ? integration : i));
      }
      return [integration, ...prev];
    });
    setConfigDialogOpen(false);
  }

  // Group connected integrations by type
  const connectedByType = integrations.reduce<Record<string, Integration[]>>(
    (acc, i) => {
      if (!acc[i.type]) acc[i.type] = [];
      acc[i.type].push(i);
      return acc;
    },
    {}
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Available Integrations Grid */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          Available Integrations
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INTEGRATION_CATALOG.map((catalog) => {
            const Icon = ICON_MAP[catalog.icon] || Webhook;
            const connected = connectedByType[catalog.type] || [];
            const activeCount = connected.filter((c) => c.is_active).length;

            return (
              <Card
                key={catalog.type}
                className="group relative overflow-hidden transition hover:border-indigo-300 dark:hover:border-indigo-700"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl text-white",
                        catalog.color
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {connected.length > 0 && (
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          activeCount > 0
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
                        )}
                      >
                        {activeCount > 0 ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            {activeCount} active
                          </>
                        ) : (
                          <>
                            <PowerOff className="h-3 w-3" />
                            Disabled
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {catalog.name}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {catalog.description}
                  </p>

                  <div className="mt-4">
                    <Button
                      size="sm"
                      variant={connected.length > 0 ? "outline" : "default"}
                      className="w-full"
                      onClick={() => handleAddNew(catalog.type)}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      {connected.length > 0 ? "Add Another" : "Connect"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Connected Integrations */}
      {integrations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            Connected Integrations
          </h2>
          <div className="space-y-3">
            {integrations.map((integration) => {
              const catalog = INTEGRATION_CATALOG.find(
                (c) => c.type === integration.type
              );
              const Icon = catalog
                ? ICON_MAP[catalog.icon] || Webhook
                : Webhook;

              return (
                <Card key={integration.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white",
                          catalog?.color || "bg-zinc-600"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                            {integration.name}
                          </h3>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              integration.is_active
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
                            )}
                          >
                            {integration.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="capitalize">{integration.type}</span>
                          {integration.last_synced_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last synced{" "}
                              {new Date(
                                integration.last_synced_at
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-1">
                        {onViewLogs && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewLogs(integration.id)}
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span className="ml-1.5 hidden sm:inline">
                              Logs
                            </span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(integration)}
                        >
                          Configure
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggle(integration)}
                          disabled={togglingId === integration.id}
                        >
                          {togglingId === integration.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : integration.is_active ? (
                            <PowerOff className="h-4 w-4 text-zinc-400" />
                          ) : (
                            <Power className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 dark:text-red-400"
                          onClick={() => handleDelete(integration.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {integrations.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 py-12 dark:border-zinc-700 dark:bg-zinc-900/50">
          <AlertCircle className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            No integrations connected yet
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Click &quot;Connect&quot; on any integration above to get started.
          </p>
        </div>
      )}

      {/* Config Dialog */}
      {configDialogOpen && configType && (
        <IntegrationConfigDialog
          type={configType}
          integration={editingIntegration}
          open={configDialogOpen}
          onClose={() => setConfigDialogOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
