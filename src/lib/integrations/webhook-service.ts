"use server";

import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// SSRF protection: block requests to internal/private networks
// ---------------------------------------------------------------------------

function isInternalUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();

    // Block obvious internal hostnames
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname === "::1" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return true;
    }

    // Block private IP ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
    const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true; // link-local / cloud metadata
      if (a === 127) return true;
      if (a === 0) return true;
    }

    // Block non-http(s) schemes
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return true;
    }

    return false;
  } catch {
    return true; // Invalid URL = block
  }
}

// ---------------------------------------------------------------------------
// Outgoing webhook dispatcher
// ---------------------------------------------------------------------------

/**
 * Finds all active webhook endpoints in a workspace subscribed to the given
 * event type and sends a POST request with an HMAC-SHA256 signature.
 */
export async function sendWebhook(
  workspaceId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ sent: number; errors: number }> {
  const supabase = await createClient();

  // Fetch active endpoints subscribed to this event
  const { data: endpoints } = await supabase
    .from("webhook_endpoints")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .contains("events", [eventType]);

  if (!endpoints || endpoints.length === 0) {
    return { sent: 0, errors: 0 };
  }

  let sent = 0;
  let errors = 0;

  const body = JSON.stringify({
    event: eventType,
    timestamp: new Date().toISOString(),
    workspace_id: workspaceId,
    data: payload,
  });

  const deliveries = endpoints.map(async (endpoint) => {
    // SSRF protection: block internal/private URLs
    if (isInternalUrl(endpoint.url)) {
      errors++;
      await supabase.from("integration_logs").insert({
        integration_id: endpoint.id,
        workspace_id: workspaceId,
        event_type: "webhook_sent",
        status: "error",
        payload: { event: eventType, endpoint_url: endpoint.url },
        error_message: "Blocked: webhook URL targets an internal or private network address",
      });
      return;
    }

    const signature = generateSignature(body, endpoint.secret);

    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WIS-Signature": signature,
          "X-WIS-Event": eventType,
          "X-WIS-Timestamp": new Date().toISOString(),
        },
        body,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (res.ok) {
        sent++;
      } else {
        errors++;
      }

      // Log the delivery attempt
      await supabase.from("integration_logs").insert({
        integration_id: endpoint.id,
        workspace_id: workspaceId,
        event_type: "webhook_sent",
        status: res.ok ? "success" : "error",
        payload: { event: eventType, endpoint_url: endpoint.url, status: res.status },
        error_message: res.ok ? null : `HTTP ${res.status}: ${res.statusText}`,
      });
    } catch (err) {
      errors++;
      await supabase.from("integration_logs").insert({
        integration_id: endpoint.id,
        workspace_id: workspaceId,
        event_type: "webhook_sent",
        status: "error",
        payload: { event: eventType, endpoint_url: endpoint.url },
        error_message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  await Promise.allSettled(deliveries);

  return { sent, errors };
}

// ---------------------------------------------------------------------------
// HMAC signature helpers
// ---------------------------------------------------------------------------

function generateSignature(payload: string, secret: string): string {
  return `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;
}

/**
 * Verify an incoming webhook signature.
 * The expected format is `sha256=<hex>`.
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = generateSignature(payload, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}
