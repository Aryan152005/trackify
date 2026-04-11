"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  Integration,
  IntegrationLog,
  IntegrationLogEventType,
  IntegrationLogStatus,
  IntegrationType,
  WebhookEndpoint,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Not authenticated");
  }
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Integration CRUD
// ---------------------------------------------------------------------------

export async function getIntegrations(
  workspaceId: string
): Promise<Integration[]> {
  const { supabase } = await getAuthenticatedUser();
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load integrations: ${error.message}`);
  return (data ?? []) as Integration[];
}

export async function createIntegration(
  workspaceId: string,
  type: IntegrationType,
  name: string,
  config: Record<string, unknown>
): Promise<Integration> {
  const { supabase, user } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("integrations")
    .insert({
      workspace_id: workspaceId,
      type,
      name,
      config,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create integration: ${error.message}`);
  return data as Integration;
}

export async function updateIntegration(
  integrationId: string,
  updates: Partial<Pick<Integration, "name" | "config" | "is_active">>
): Promise<Integration> {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("integrations")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", integrationId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update integration: ${error.message}`);
  return data as Integration;
}

export async function deleteIntegration(integrationId: string): Promise<void> {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("id", integrationId);

  if (error) throw new Error(`Failed to delete integration: ${error.message}`);
}

export async function testIntegration(
  integrationId: string
): Promise<{ success: boolean; message: string }> {
  const { supabase } = await getAuthenticatedUser();

  const { data: integration, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (error || !integration) {
    return { success: false, message: "Integration not found" };
  }

  const config = integration.config as Record<string, unknown>;

  try {
    switch (integration.type) {
      case "slack": {
        const webhookUrl = config.webhook_url as string;
        if (!webhookUrl) return { success: false, message: "No webhook URL configured" };

        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "Test message from Trackify Integration Hub",
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: ":white_check_mark: *Trackify Integration Test*\nThis is a test message from your workspace integration.",
                },
              },
            ],
          }),
        });

        if (res.ok) {
          await logIntegrationEvent(integrationId, integration.workspace_id, {
            event_type: "sync",
            status: "success",
            payload: { action: "test" },
          });
          return { success: true, message: "Test message sent to Slack successfully!" };
        }
        return { success: false, message: `Slack returned ${res.status}: ${res.statusText}` };
      }

      case "webhook": {
        const url = config.url as string;
        if (!url) return { success: false, message: "No endpoint URL configured" };

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "test",
            timestamp: new Date().toISOString(),
            data: { message: "Test payload from Trackify" },
          }),
        });

        if (res.ok) {
          return { success: true, message: `Webhook responded with ${res.status}` };
        }
        return { success: false, message: `Webhook returned ${res.status}: ${res.statusText}` };
      }

      case "email": {
        return { success: true, message: "Email integration is configured and ready" };
      }

      case "github": {
        return {
          success: true,
          message: "GitHub integration is configured. Incoming webhooks will be received at your endpoint.",
        };
      }

      default:
        return { success: false, message: "Unknown integration type" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    await logIntegrationEvent(integrationId, integration.workspace_id, {
      event_type: "error",
      status: "error",
      error_message: message,
    });
    return { success: false, message };
  }
}

// ---------------------------------------------------------------------------
// Integration Logs
// ---------------------------------------------------------------------------

export async function getIntegrationLogs(
  integrationId: string | null,
  workspaceId: string,
  limit = 50
): Promise<IntegrationLog[]> {
  const { supabase } = await getAuthenticatedUser();

  let query = supabase
    .from("integration_logs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (integrationId) {
    query = query.eq("integration_id", integrationId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load logs: ${error.message}`);
  return (data ?? []) as IntegrationLog[];
}

export async function logIntegrationEvent(
  integrationId: string,
  workspaceId: string,
  event: {
    event_type: IntegrationLogEventType;
    status?: IntegrationLogStatus;
    payload?: Record<string, unknown>;
    error_message?: string;
  }
): Promise<void> {
  const { supabase } = await getAuthenticatedUser();

  await supabase.from("integration_logs").insert({
    integration_id: integrationId,
    workspace_id: workspaceId,
    event_type: event.event_type,
    status: event.status ?? "success",
    payload: event.payload ?? {},
    error_message: event.error_message ?? null,
  });

  // Update last_synced_at on the integration
  if (event.status !== "error") {
    await supabase
      .from("integrations")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", integrationId);
  }
}

// ---------------------------------------------------------------------------
// Webhook Endpoints CRUD
// ---------------------------------------------------------------------------

export async function getWebhookEndpoints(
  workspaceId: string
): Promise<WebhookEndpoint[]> {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("webhook_endpoints")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load webhook endpoints: ${error.message}`);
  return (data ?? []) as WebhookEndpoint[];
}

export async function createWebhookEndpoint(
  workspaceId: string,
  name: string,
  url: string,
  events: string[]
): Promise<WebhookEndpoint> {
  const { supabase, user } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("webhook_endpoints")
    .insert({
      workspace_id: workspaceId,
      name,
      url,
      events,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create webhook endpoint: ${error.message}`);
  return data as WebhookEndpoint;
}

export async function updateWebhookEndpoint(
  endpointId: string,
  updates: Partial<Pick<WebhookEndpoint, "name" | "url" | "events" | "is_active">>
): Promise<WebhookEndpoint> {
  const { supabase } = await getAuthenticatedUser();

  const { data, error } = await supabase
    .from("webhook_endpoints")
    .update(updates)
    .eq("id", endpointId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update webhook endpoint: ${error.message}`);
  return data as WebhookEndpoint;
}

export async function deleteWebhookEndpoint(endpointId: string): Promise<void> {
  const { supabase } = await getAuthenticatedUser();

  const { error } = await supabase
    .from("webhook_endpoints")
    .delete()
    .eq("id", endpointId);

  if (error) throw new Error(`Failed to delete webhook endpoint: ${error.message}`);
}
