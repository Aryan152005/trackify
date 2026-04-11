"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Webhook,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import {
  getWebhookEndpoints,
  createWebhookEndpoint,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
} from "@/lib/integrations/actions";
import { WEBHOOK_EVENT_TYPES, type WebhookEndpoint } from "@/lib/integrations/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function WebhookManager() {
  const workspaceId = useWorkspaceId();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedSecrets, setExpandedSecrets] = useState<Set<string>>(
    new Set()
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Test state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    ok: boolean;
    message: string;
  } | null>(null);

  const fetchEndpoints = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await getWebhookEndpoints(workspaceId);
      setEndpoints(data);
    } catch {
      // handle error
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  function toggleEvent(event: string) {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!workspaceId) return;
    if (!formName.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!formUrl.trim()) {
      setFormError("URL is required.");
      return;
    }
    if (formEvents.length === 0) {
      setFormError("Select at least one event type.");
      return;
    }

    setSaving(true);
    try {
      const endpoint = await createWebhookEndpoint(
        workspaceId,
        formName.trim(),
        formUrl.trim(),
        formEvents
      );
      setEndpoints((prev) => [endpoint, ...prev]);
      setFormName("");
      setFormUrl("");
      setFormEvents([]);
      setShowForm(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create endpoint"
      );
    }
    setSaving(false);
  }

  async function handleToggleActive(endpoint: WebhookEndpoint) {
    try {
      const updated = await updateWebhookEndpoint(endpoint.id, {
        is_active: !endpoint.is_active,
      });
      setEndpoints((prev) =>
        prev.map((ep) => (ep.id === updated.id ? updated : ep))
      );
    } catch {
      // handle error
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteWebhookEndpoint(id);
      setEndpoints((prev) => prev.filter((ep) => ep.id !== id));
    } catch {
      // handle error
    }
  }

  async function handleTest(endpoint: WebhookEndpoint) {
    setTestingId(endpoint.id);
    setTestResult(null);

    try {
      const res = await fetch("/api/webhooks/outgoing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint_id: endpoint.id }),
      });

      const data = await res.json();
      setTestResult({
        id: endpoint.id,
        ok: data.success,
        message: data.message,
      });
    } catch {
      setTestResult({
        id: endpoint.id,
        ok: false,
        message: "Failed to send test webhook",
      });
    }
    setTestingId(null);
  }

  function handleCopySecret(id: string, secret: string) {
    navigator.clipboard.writeText(secret);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleSecretVisibility(id: string) {
    setExpandedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Outgoing Webhooks
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Send workspace events to external services via HTTP webhooks.
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Endpoint
          </Button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Webhook Endpoint</CardTitle>
            <CardDescription>
              Trackify will send a POST request with a signed JSON payload for each
              subscribed event.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Name
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Production Webhook"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Endpoint URL
                </label>
                <input
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://your-service.com/webhook"
                  type="url"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Events
                </label>
                <div className="flex flex-wrap gap-2">
                  {WEBHOOK_EVENT_TYPES.map((event) => (
                    <button
                      key={event}
                      type="button"
                      onClick={() => toggleEvent(event)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                        formEvents.includes(event)
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300"
                          : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500"
                      )}
                    >
                      {event}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {formError}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Endpoint"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowForm(false);
                    setFormError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Endpoints List */}
      {endpoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 py-12 dark:border-zinc-700 dark:bg-zinc-900/50">
          <Webhook className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            No webhook endpoints configured
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Add an endpoint to start sending workspace events externally.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {endpoints.map((endpoint) => (
            <Card key={endpoint.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                        {endpoint.name}
                      </h3>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          endpoint.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
                        )}
                      >
                        {endpoint.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 truncate font-mono">
                      {endpoint.url}
                    </p>

                    {/* Events */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {endpoint.events.map((evt) => (
                        <span
                          key={evt}
                          className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        >
                          {evt}
                        </span>
                      ))}
                    </div>

                    {/* Secret (expandable) */}
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => toggleSecretVisibility(endpoint.id)}
                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        {expandedSecrets.has(endpoint.id) ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        Signing Secret
                      </button>
                      {expandedSecrets.has(endpoint.id) && (
                        <div className="mt-1 flex items-center gap-2">
                          <code className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 break-all">
                            {endpoint.secret}
                          </code>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopySecret(endpoint.id, endpoint.secret)
                            }
                            className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                          >
                            {copiedId === endpoint.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Test result */}
                    {testResult?.id === endpoint.id && (
                      <div
                        className={cn(
                          "mt-2 flex items-center gap-1.5 text-xs",
                          testResult.ok
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {testResult.ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                        {testResult.message}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTest(endpoint)}
                      disabled={testingId === endpoint.id}
                    >
                      {testingId === endpoint.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span className="ml-1.5 hidden sm:inline">Test</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(endpoint)}
                    >
                      {endpoint.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
                      onClick={() => handleDelete(endpoint.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
