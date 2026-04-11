"use server";

import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Email connector using Resend
// ---------------------------------------------------------------------------

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || "Trackify <noreply@yourdomain.com>";
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://trackify.vercel.app";
}

/**
 * Send a simple email notification via Resend.
 */
export async function sendEmailNotification(
  to: string | string[],
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResend();
    const recipients = Array.isArray(to) ? to : [to];

    await resend.emails.send({
      from: getFromEmail(),
      to: recipients,
      subject,
      html: wrapHtmlTemplate(body),
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}

/**
 * Send a daily/weekly digest email summarising workspace activity.
 */
export async function sendDigestEmail(
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();

  // Get user email
  const { data: userData } = await admin.auth.admin.getUserById(userId);
  if (!userData?.user?.email) {
    return { success: false, error: "User email not found" };
  }

  // Get user profile name
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name")
    .eq("user_id", userId)
    .single();

  const userName = profile?.name || "there";

  // Get workspace info
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .single();

  const workspaceName = workspace?.name || "your workspace";

  // Gather recent activity (last 24 hours for daily, 7 days for weekly)
  const since = new Date();
  since.setDate(since.getDate() - 1);
  const sinceStr = since.toISOString();

  // Recent entries
  const { data: entries } = await supabase
    .from("work_entries")
    .select("id, date, user_id")
    .eq("workspace_id", workspaceId)
    .gte("created_at", sinceStr)
    .order("created_at", { ascending: false })
    .limit(10);

  // Recent tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, status, priority")
    .eq("workspace_id", workspaceId)
    .gte("created_at", sinceStr)
    .order("created_at", { ascending: false })
    .limit(10);

  // Completed tasks
  const { data: completedTasks } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("workspace_id", workspaceId)
    .eq("status", "done")
    .gte("updated_at", sinceStr)
    .limit(10);

  // Build HTML
  const entryCount = entries?.length ?? 0;
  const newTaskCount = tasks?.length ?? 0;
  const completedCount = completedTasks?.length ?? 0;

  const taskList =
    tasks && tasks.length > 0
      ? tasks
          .map(
            (t) =>
              `<li style="margin-bottom:4px;"><strong>${escapeHtml(t.title)}</strong> <span style="color:#888;">(${t.status} / ${t.priority})</span></li>`
          )
          .join("")
      : "<li>No new tasks</li>";

  const html = `
    <h2 style="color:#6366f1;">Hi ${escapeHtml(userName)}!</h2>
    <p>Here's your daily digest for <strong>${escapeHtml(workspaceName)}</strong>:</p>

    <div style="margin:20px 0;padding:16px;background:#f8f9fa;border-radius:8px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 16px;text-align:center;">
            <div style="font-size:24px;font-weight:bold;color:#6366f1;">${entryCount}</div>
            <div style="font-size:12px;color:#666;">New Entries</div>
          </td>
          <td style="padding:8px 16px;text-align:center;">
            <div style="font-size:24px;font-weight:bold;color:#f59e0b;">${newTaskCount}</div>
            <div style="font-size:12px;color:#666;">New Tasks</div>
          </td>
          <td style="padding:8px 16px;text-align:center;">
            <div style="font-size:24px;font-weight:bold;color:#10b981;">${completedCount}</div>
            <div style="font-size:12px;color:#666;">Completed</div>
          </td>
        </tr>
      </table>
    </div>

    <h3 style="color:#333;">Recent Tasks</h3>
    <ul style="padding-left:20px;">${taskList}</ul>

    <a href="${getAppUrl()}/dashboard"
       style="display:inline-block;margin-top:20px;padding:12px 24px;background-color:#6366f1;color:white;text-decoration:none;border-radius:6px;">
      Open Dashboard
    </a>

    <p style="margin-top:30px;color:#999;font-size:12px;">
      You're receiving this digest for ${escapeHtml(workspaceName)}.
    </p>
  `;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: getFromEmail(),
      to: userData.user.email,
      subject: `Daily Digest: ${workspaceName}`,
      html: wrapHtmlTemplate(html),
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send digest",
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapHtmlTemplate(body: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
      ${body}
    </body>
    </html>
  `;
}
