"use client";

import { useState } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
} from "lucide-react";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import {
  createIntegration,
  updateIntegration,
  testIntegration,
} from "@/lib/integrations/actions";
import {
  INTEGRATION_CATALOG,
  type Integration,
  type IntegrationType,
} from "@/lib/integrations/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IntegrationConfigDialogProps {
  type: IntegrationType;
  integration: Integration | null; // null = creating new
  open: boolean;
  onClose: () => void;
  onSaved: (integration: Integration) => void;
}

export function IntegrationConfigDialog({
  type,
  integration,
  open,
  onClose,
  onSaved,
}: IntegrationConfigDialogProps) {
  const workspaceId = useWorkspaceId();
  const catalog = INTEGRATION_CATALOG.find((c) => c.type === type);

  const [name, setName] = useState(integration?.name || catalog?.name || "");
  const [configValues, setConfigValues] = useState<Record<string, string>>(
    () => {
      if (integration?.config) {
        const cfg = integration.config as Record<string, unknown>;
        const values: Record<string, string> = {};
        for (const [key, value] of Object.entries(cfg)) {
          if (Array.isArray(value)) {
            values[key] = value.join(", ");
          } else {
            values[key] = String(value ?? "");
          }
        }
        return values;
      }
      return {};
    }
  );

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open || !catalog) return null;

  function updateConfigValue(key: string, value: string) {
    setConfigValues((prev) => ({ ...prev, [key]: value }));
  }

  function buildConfig(): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    for (const field of catalog!.configFields) {
      const raw = configValues[field.key] ?? "";
      if (field.type === "multi-select") {
        config[field.key] = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (field.key === "recipients") {
        config[field.key] = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        config[field.key] = raw;
      }
    }
    return config;
  }

  async function handleSave() {
    if (!workspaceId) return;
    setError(null);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    // Validate required fields
    for (const field of catalog!.configFields) {
      if (field.required && !configValues[field.key]?.trim()) {
        setError(`${field.label} is required.`);
        return;
      }
    }

    setSaving(true);
    try {
      const config = buildConfig();

      if (integration) {
        // Update
        const updated = await updateIntegration(integration.id, {
          name: name.trim(),
          config,
        });
        onSaved(updated);
      } else {
        // Create
        const created = await createIntegration(
          workspaceId,
          type,
          name.trim(),
          config
        );
        onSaved(created);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save integration"
      );
    }
    setSaving(false);
  }

  async function handleTest() {
    if (!integration) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testIntegration(integration.id);
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: "Test failed" });
    }
    setTesting(false);
  }

  // Generate incoming webhook URL for GitHub/webhook types
  const incomingWebhookUrl =
    integration && (type === "github" || type === "webhook")
      ? `${
          typeof window !== "undefined" ? window.location.origin : ""
        }/api/webhooks/incoming/${integration.id}`
      : null;

  function handleCopyUrl() {
    if (!incomingWebhookUrl) return;
    navigator.clipboard.writeText(incomingWebhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Multi-select toggle for fields like GitHub events
  function toggleMultiSelectValue(key: string, value: string) {
    const current = (configValues[key] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];

    updateConfigValue(key, updated.join(", "));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {integration ? "Configure" : "Connect"} {catalog.name}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {catalog.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Integration Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Integration Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`My ${catalog.name} Integration`}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>

          {/* Dynamic config fields */}
          {catalog.configFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                {field.label}
                {field.required && (
                  <span className="text-red-500 ml-0.5">*</span>
                )}
              </label>

              {field.type === "multi-select" && field.options ? (
                <div className="flex flex-wrap gap-2">
                  {field.options.map((opt) => {
                    const selected = (configValues[field.key] ?? "")
                      .split(",")
                      .map((s) => s.trim())
                      .includes(opt.value);

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          toggleMultiSelectValue(field.key, opt.value)
                        }
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                          selected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300"
                            : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              ) : field.type === "select" && field.options ? (
                <select
                  value={configValues[field.key] ?? ""}
                  onChange={(e) => updateConfigValue(field.key, e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">Select...</option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  value={configValues[field.key] ?? ""}
                  onChange={(e) => updateConfigValue(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              ) : (
                <input
                  type={field.type === "url" ? "url" : field.type === "email" ? "email" : "text"}
                  value={configValues[field.key] ?? ""}
                  onChange={(e) => updateConfigValue(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              )}
            </div>
          ))}

          {/* Incoming Webhook URL (for GitHub / Webhook types) */}
          {incomingWebhookUrl && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Incoming Webhook URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={incomingWebhookUrl}
                  className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-mono text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                Use this URL in your {type === "github" ? "GitHub repository webhook settings" : "external service"} to send events to Trackify.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Test Result */}
          {testResult && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg border p-3 text-sm",
                testResult.success
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
              )}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              {testResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {integration && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing}
                >
                  {testing ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : integration ? (
                  "Save Changes"
                ) : (
                  "Connect"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
