"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/actions";
import { logEvent } from "@/lib/logs/logger";

// ---------------------------------------------------------------------------
// Whitelist management (DB-only — emails are sent manually via preview+copy)
// ---------------------------------------------------------------------------

export async function addToWhitelist(email: string) {
  const adminUser = await requireAdmin();
  const admin = createAdminClient();

  const normalizedEmail = email.toLowerCase().trim();

  const { error } = await admin
    .from("email_whitelist")
    .upsert({ email: normalizedEmail }, { onConflict: "email" });

  if (error) {
    await logEvent({
      service: "email",
      level: "error",
      tag: "whitelist.add",
      message: `Failed to whitelist ${normalizedEmail}: ${error.message}`,
      metadata: { email: normalizedEmail, code: error.code },
      userId: adminUser.id,
    });
    throw new Error(`Failed to whitelist: ${error.message}`);
  }

  await logEvent({
    service: "email",
    level: "info",
    tag: "whitelist.add",
    message: `Whitelisted ${normalizedEmail}`,
    metadata: { email: normalizedEmail },
    userId: adminUser.id,
  });

  return { email: normalizedEmail };
}

export async function removeFromWhitelist(email: string) {
  const adminUser = await requireAdmin();
  const admin = createAdminClient();

  const normalizedEmail = email.toLowerCase().trim();
  const { error } = await admin
    .from("email_whitelist")
    .delete()
    .eq("email", normalizedEmail);

  if (error) {
    await logEvent({
      service: "email",
      level: "error",
      tag: "whitelist.remove",
      message: `Failed to remove ${normalizedEmail}: ${error.message}`,
      metadata: { email: normalizedEmail, code: error.code },
      userId: adminUser.id,
    });
    throw new Error(`Failed to remove: ${error.message}`);
  }

  await logEvent({
    service: "email",
    level: "info",
    tag: "whitelist.remove",
    message: `Removed ${normalizedEmail} from whitelist`,
    metadata: { email: normalizedEmail },
    userId: adminUser.id,
  });
}

export async function getWhitelist() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("email_whitelist")
    .select("email, created_at")
    .order("created_at", { ascending: false });

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Whitelist requests
// ---------------------------------------------------------------------------

export async function getWhitelistRequests() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("whitelist_requests")
    .select("*")
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function approveWhitelistRequest(requestId: string) {
  const adminUser = await requireAdmin();
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("whitelist_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request) {
    await logEvent({
      service: "email",
      level: "warn",
      tag: "whitelist.approve",
      message: `Approve failed: request ${requestId} not found`,
      metadata: { requestId },
      userId: adminUser.id,
    });
    throw new Error("Request not found");
  }

  await admin
    .from("email_whitelist")
    .upsert({ email: request.email }, { onConflict: "email" });

  await admin
    .from("whitelist_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  await logEvent({
    service: "email",
    level: "info",
    tag: "whitelist.approve",
    message: `Approved access request for ${request.email}`,
    metadata: { requestId, email: request.email, name: request.name },
    userId: adminUser.id,
  });

  return { email: request.email, name: request.name as string | null };
}

/**
 * Admin decision counterpart: mark a pending access request as denied.
 * Does NOT add the email to the whitelist and does NOT send an automatic
 * rejection email — admins can still choose to email them manually via the
 * targeted email composer if they want to explain. We log the action with
 * the admin's id so the audit trail is clean.
 */
export async function denyWhitelistRequest(requestId: string, reason?: string) {
  const adminUser = await requireAdmin();
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("whitelist_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request) {
    await logEvent({
      service: "email",
      level: "warn",
      tag: "whitelist.deny",
      message: `Deny failed: request ${requestId} not found`,
      metadata: { requestId },
      userId: adminUser.id,
    });
    throw new Error("Request not found");
  }

  const { error } = await admin
    .from("whitelist_requests")
    .update({ status: "denied" })
    .eq("id", requestId);
  if (error) throw new Error(`Failed to deny request: ${error.message}`);

  await logEvent({
    service: "email",
    level: "info",
    tag: "whitelist.deny",
    message: `Denied access request for ${request.email}${reason ? ` — ${reason}` : ""}`,
    metadata: { requestId, email: request.email, name: request.name, reason: reason ?? null },
    userId: adminUser.id,
  });

  return { email: request.email, name: request.name as string | null };
}
