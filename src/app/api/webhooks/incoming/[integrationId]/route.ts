import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

/**
 * Incoming webhook receiver.
 * Accepts POST from external services (GitHub, custom), verifies signature,
 * logs the event, and can trigger workspace actions.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  const { integrationId } = await params;

  const admin = createAdminClient();

  // Fetch the integration
  const { data: integration, error } = await admin
    .from("integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (error || !integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  if (!integration.is_active) {
    return NextResponse.json(
      { error: "Integration is disabled" },
      { status: 403 }
    );
  }

  const rawBody = await request.text();
  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const config = integration.config as Record<string, unknown>;

  // ---------------------------------------------------------------------------
  // Verify signature based on integration type
  // ---------------------------------------------------------------------------
  if (integration.type === "github") {
    const ghSignature = request.headers.get("x-hub-signature-256");
    const secret = config.webhook_secret as string;

    if (secret && ghSignature) {
      const expected = `sha256=${crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex")}`;

      const valid = safeCompare(ghSignature, expected);
      if (!valid) {
        await admin.from("integration_logs").insert({
          integration_id: integrationId,
          workspace_id: integration.workspace_id,
          event_type: "webhook_received",
          status: "error",
          error_message: "Invalid signature",
          payload: { headers: Object.fromEntries(request.headers.entries()) },
        });

        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }
  } else if (integration.type === "webhook") {
    const wisSignature = request.headers.get("x-wis-signature");
    const secret = config.secret as string;

    if (secret && wisSignature) {
      const expected = `sha256=${crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex")}`;

      if (!safeCompare(wisSignature, expected)) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Determine event type
  // ---------------------------------------------------------------------------
  let eventType = "webhook_received";
  const ghEvent = request.headers.get("x-github-event");
  if (ghEvent) {
    eventType = `github.${ghEvent}`;
  }

  // ---------------------------------------------------------------------------
  // Log the incoming event
  // ---------------------------------------------------------------------------
  await admin.from("integration_logs").insert({
    integration_id: integrationId,
    workspace_id: integration.workspace_id,
    event_type: "webhook_received",
    status: "success",
    payload: {
      event: eventType,
      data: truncatePayload(payload),
    },
  });

  // Update last synced
  await admin
    .from("integrations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", integrationId);

  // ---------------------------------------------------------------------------
  // Handle specific GitHub events
  // ---------------------------------------------------------------------------
  if (ghEvent === "push" && payload.commits) {
    // Could create work entries or task updates from commits
    // For now, just log it
  }

  if (ghEvent === "pull_request" && payload.action) {
    // Could create tasks from PRs or update board cards
  }

  return NextResponse.json({
    received: true,
    event: eventType,
    integration_id: integrationId,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeCompare(a: string, b: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function truncatePayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const str = JSON.stringify(payload);
  if (str.length <= 10000) return payload;
  // Store a truncated version for the log
  return {
    _truncated: true,
    _size: str.length,
    keys: Object.keys(payload),
  };
}
