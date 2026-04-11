import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * Test outgoing webhook delivery.
 * POST { endpoint_id } to send a test payload to the specified webhook endpoint.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Verify auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { endpoint_id } = body as { endpoint_id?: string };

  if (!endpoint_id) {
    return NextResponse.json(
      { error: "endpoint_id is required" },
      { status: 400 }
    );
  }

  // Fetch endpoint
  const { data: endpoint, error } = await supabase
    .from("webhook_endpoints")
    .select("*")
    .eq("id", endpoint_id)
    .single();

  if (error || !endpoint) {
    return NextResponse.json(
      { error: "Webhook endpoint not found" },
      { status: 404 }
    );
  }

  // Build test payload
  const testPayload = JSON.stringify({
    event: "test",
    timestamp: new Date().toISOString(),
    workspace_id: endpoint.workspace_id,
    data: {
      message: "This is a test webhook delivery from Trackify",
      endpoint_name: endpoint.name,
    },
  });

  const signature = `sha256=${crypto
    .createHmac("sha256", endpoint.secret)
    .update(testPayload)
    .digest("hex")}`;

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WIS-Signature": signature,
        "X-WIS-Event": "test",
        "X-WIS-Timestamp": new Date().toISOString(),
      },
      body: testPayload,
      signal: AbortSignal.timeout(10000),
    });

    // Log the test delivery
    await supabase.from("integration_logs").insert({
      integration_id: endpoint.id,
      workspace_id: endpoint.workspace_id,
      event_type: "webhook_sent",
      status: res.ok ? "success" : "error",
      payload: {
        event: "test",
        endpoint_url: endpoint.url,
        status: res.status,
      },
      error_message: res.ok ? null : `HTTP ${res.status}: ${res.statusText}`,
    });

    if (res.ok) {
      return NextResponse.json({
        success: true,
        message: `Test delivered successfully (${res.status})`,
      });
    }

    return NextResponse.json({
      success: false,
      message: `Endpoint returned ${res.status}: ${res.statusText}`,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      message:
        err instanceof Error ? err.message : "Failed to reach endpoint",
    });
  }
}
