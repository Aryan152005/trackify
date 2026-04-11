"use server";

import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/actions";
import {
  welcomeEmail,
  notificationEmail,
  whitelistApprovedEmail,
} from "@/lib/email/template";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return new Resend(key);
}

function getFrom(): string {
  return process.env.RESEND_FROM_EMAIL || "Trackify <onboarding@resend.dev>";
}

// ---------------------------------------------------------------------------
// Send notification email to specific users
// ---------------------------------------------------------------------------

export async function sendNotificationToUsers(
  userIds: string[],
  subject: string,
  message: string
) {
  await requireAdmin();
  const admin = createAdminClient();
  const resend = getResend();
  const from = getFrom();

  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const userId of userIds) {
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(userId);
      const email = authUser?.user?.email;
      if (!email) {
        results.push({ email: userId, success: false, error: "No email found" });
        continue;
      }

      const tpl = notificationEmail(subject, message);
      await resend.emails.send({
        from,
        to: email,
        subject: tpl.subject,
        html: tpl.html,
      });

      results.push({ email, success: true });
    } catch (e) {
      results.push({ email: userId, success: false, error: String(e) });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Send broadcast to ALL users
// ---------------------------------------------------------------------------

export async function sendBroadcast(subject: string, message: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const resend = getResend();
  const from = getFrom();

  const { data: authData } = await admin.auth.admin.listUsers();
  const users = authData?.users ?? [];

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.email) continue;
    try {
      const tpl = notificationEmail(subject, message);
      await resend.emails.send({
        from,
        to: user.email,
        subject: tpl.subject,
        html: tpl.html,
      });
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, failed, total: users.length };
}

// ---------------------------------------------------------------------------
// Whitelist management
// ---------------------------------------------------------------------------

export async function addToWhitelist(email: string, sendInvite: boolean) {
  await requireAdmin();
  const admin = createAdminClient();
  const resend = getResend();
  const from = getFrom();

  const normalizedEmail = email.toLowerCase().trim();

  const { error } = await admin
    .from("email_whitelist")
    .upsert({ email: normalizedEmail }, { onConflict: "email" });

  if (error) throw new Error(`Failed to whitelist: ${error.message}`);

  if (sendInvite) {
    try {
      const tpl = whitelistApprovedEmail("", normalizedEmail);
      await resend.emails.send({
        from,
        to: normalizedEmail,
        subject: tpl.subject,
        html: tpl.html,
      });
    } catch {
      // Email failed but whitelist succeeded
    }
  }

  return { email: normalizedEmail };
}

export async function removeFromWhitelist(email: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("email_whitelist")
    .delete()
    .eq("email", email.toLowerCase().trim());

  if (error) throw new Error(`Failed to remove: ${error.message}`);
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
// Whitelist requests (public — no admin check)
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
  await requireAdmin();
  const admin = createAdminClient();
  const resend = getResend();
  const from = getFrom();

  const { data: request } = await admin
    .from("whitelist_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!request) throw new Error("Request not found");

  // Add to whitelist
  await admin
    .from("email_whitelist")
    .upsert({ email: request.email }, { onConflict: "email" });

  // Mark request as approved
  await admin
    .from("whitelist_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  // Send approval email
  try {
    const tpl = whitelistApprovedEmail(request.name || "", request.email);
    await resend.emails.send({
      from,
      to: request.email,
      subject: tpl.subject,
      html: tpl.html,
    });
  } catch {
    // Email failed but approval succeeded
  }

  return { email: request.email };
}
