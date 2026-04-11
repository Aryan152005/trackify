/**
 * Professional HTML email template for Trackify.
 * Used by all outgoing emails (admin notifications, reminders, invitations).
 */

const APP_NAME = "Trackify";

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://trackify.vercel.app";
}

export function emailLayout(body: string, preheader?: string): string {
  const appUrl = getAppUrl();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
${preheader ? `<span style="display:none;max-height:0;overflow:hidden">${preheader}</span>` : ""}
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
  <!-- Header -->
  <tr>
    <td style="padding:28px 32px 20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);text-align:center">
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px">${APP_NAME}</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px">Smart Work Tracker</p>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="padding:32px">
      ${body}
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center">
      <p style="margin:0;font-size:12px;color:#a1a1aa">
        <a href="${appUrl}" style="color:#6366f1;text-decoration:none">${APP_NAME}</a> &middot; Your all-in-one workspace
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#d4d4d8">
        You received this email because you have an account on ${APP_NAME}.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function buttonHtml(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td>
    <a href="${url}" style="display:inline-block;padding:12px 28px;background:#6366f1;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px">${text}</a>
  </td></tr></table>`;
}

// ---------------------------------------------------------------------------
// Pre-built email templates
// ---------------------------------------------------------------------------

export function welcomeEmail(name: string): { subject: string; html: string } {
  const appUrl = getAppUrl();
  return {
    subject: `Welcome to ${APP_NAME}, ${name}!`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:20px;color:#18181b">Welcome aboard, ${name}!</h2>
      <p style="margin:0 0 12px;color:#52525b;font-size:15px;line-height:1.6">
        Your ${APP_NAME} account is ready. Here's what you can do:
      </p>
      <ul style="margin:0 0 16px;padding-left:20px;color:#52525b;font-size:14px;line-height:2">
        <li><strong>Track your work</strong> with daily entries and productivity scores</li>
        <li><strong>Manage tasks</strong> on beautiful Kanban boards</li>
        <li><strong>Take notes</strong> with our rich block editor</li>
        <li><strong>Collaborate</strong> with your team in real-time</li>
        <li><strong>Get insights</strong> from analytics and reports</li>
      </ul>
      ${buttonHtml("Open Trackify", appUrl + "/dashboard")}
      <p style="margin:0;color:#a1a1aa;font-size:13px">Happy tracking!</p>
    `, `Welcome to ${APP_NAME} — your workspace is ready`),
  };
}

export function notificationEmail(subject: string, message: string): { subject: string; html: string } {
  return {
    subject: `[${APP_NAME}] ${subject}`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:20px;color:#18181b">${subject}</h2>
      <p style="margin:0;color:#52525b;font-size:15px;line-height:1.7">${message}</p>
    `, subject),
  };
}

export function whitelistApprovedEmail(name: string, email: string): { subject: string; html: string } {
  const appUrl = getAppUrl();
  return {
    subject: `You're in! Access granted to ${APP_NAME}`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:20px;color:#18181b">You've been approved!</h2>
      <p style="margin:0 0 12px;color:#52525b;font-size:15px;line-height:1.6">
        Hi${name ? ` ${name}` : ""},<br/>
        Your email <strong>${email}</strong> has been approved for ${APP_NAME}.
        You can now create your account and start using the platform.
      </p>
      ${buttonHtml("Create Your Account", appUrl + "/signup")}
    `, `Your access to ${APP_NAME} has been approved`),
  };
}

export function feedbackThankYouEmail(name: string): { subject: string; html: string } {
  return {
    subject: `Thanks for your feedback, ${name}!`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:20px;color:#18181b">We got your feedback!</h2>
      <p style="margin:0;color:#52525b;font-size:15px;line-height:1.6">
        Thanks ${name}, your feedback helps us make ${APP_NAME} better.
        We review every submission and will reach out if we have questions.
      </p>
    `, "Thanks for sharing your thoughts"),
  };
}

export function inviteEmail(name: string, inviterName: string, workspaceName: string, inviteUrl: string): { subject: string; html: string } {
  return {
    subject: `${inviterName} invited you to ${workspaceName} on ${APP_NAME}`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:20px;color:#18181b">You've been invited!</h2>
      <p style="margin:0 0 12px;color:#52525b;font-size:15px;line-height:1.6">
        Hi${name ? ` ${name}` : ""},<br/>
        <strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> on ${APP_NAME}.
      </p>
      <p style="margin:0 0 12px;color:#52525b;font-size:14px;line-height:1.6">
        ${APP_NAME} is an all-in-one workspace where your team can:
      </p>
      <ul style="margin:0 0 16px;padding-left:20px;color:#52525b;font-size:14px;line-height:2">
        <li>Track daily work with productivity scores</li>
        <li>Manage tasks on visual Kanban boards</li>
        <li>Write rich notes and documentation</li>
        <li>Collaborate in real-time with comments and mentions</li>
        <li>Get insights from analytics and export reports</li>
      </ul>
      ${buttonHtml("Accept Invite", inviteUrl)}
      <p style="margin:16px 0 0;color:#a1a1aa;font-size:12px">
        This invite expires in 7 days. If you didn't expect this, you can safely ignore it.
      </p>
    `, `${inviterName} invited you to ${workspaceName}`),
  };
}

export function maintenanceEmail(scheduledTime: string, duration: string, details: string): { subject: string; html: string } {
  return {
    subject: `[${APP_NAME}] Scheduled Maintenance`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:20px;color:#18181b">Scheduled Maintenance</h2>
      <div style="margin:0 0 16px;padding:16px;background:#fef3c7;border-radius:8px;border-left:4px solid #f59e0b">
        <p style="margin:0;color:#92400e;font-size:14px;font-weight:600">Planned downtime</p>
        <p style="margin:4px 0 0;color:#92400e;font-size:13px">
          <strong>When:</strong> ${scheduledTime}<br/>
          <strong>Duration:</strong> ~${duration}
        </p>
      </div>
      <p style="margin:0 0 12px;color:#52525b;font-size:15px;line-height:1.6">${details}</p>
      <p style="margin:0;color:#a1a1aa;font-size:13px">
        We'll notify you when maintenance is complete. Your data is safe.
      </p>
    `, `Scheduled maintenance on ${scheduledTime}`),
  };
}

export function newFeatureEmail(featureName: string, description: string, ctaText: string, ctaUrl: string): { subject: string; html: string } {
  return {
    subject: `New in ${APP_NAME}: ${featureName}`,
    html: emailLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#18181b">Something new just dropped</h2>
      <p style="margin:0 0 16px;color:#6366f1;font-size:16px;font-weight:600">${featureName}</p>
      <p style="margin:0 0 16px;color:#52525b;font-size:15px;line-height:1.6">${description}</p>
      ${buttonHtml(ctaText, ctaUrl)}
    `, `New feature: ${featureName}`),
  };
}

export function weeklyDigestEmail(name: string, stats: { entries: number; tasks: number; tasksCompleted: number; score: string }): { subject: string; html: string } {
  const appUrl = getAppUrl();
  return {
    subject: `Your weekly recap, ${name}`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px;font-size:20px;color:#18181b">Your Week in Review</h2>
      <p style="margin:0 0 16px;color:#52525b;font-size:15px">Here's how your week went, ${name}:</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px">
        <tr>
          <td style="padding:12px;text-align:center;background:#f0f0ff;border-radius:8px 0 0 8px">
            <p style="margin:0;font-size:24px;font-weight:700;color:#6366f1">${stats.entries}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#71717a">Entries</p>
          </td>
          <td style="padding:12px;text-align:center;background:#f0fdf4">
            <p style="margin:0;font-size:24px;font-weight:700;color:#10b981">${stats.tasksCompleted}/${stats.tasks}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#71717a">Tasks Done</p>
          </td>
          <td style="padding:12px;text-align:center;background:#fefce8;border-radius:0 8px 8px 0">
            <p style="margin:0;font-size:24px;font-weight:700;color:#f59e0b">${stats.score}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#71717a">Avg Score</p>
          </td>
        </tr>
      </table>
      ${buttonHtml("View Full Analytics", appUrl + "/analytics")}
    `, `${stats.entries} entries, ${stats.tasksCompleted} tasks done this week`),
  };
}

// ---------------------------------------------------------------------------
// Available template IDs for admin UI
// ---------------------------------------------------------------------------

export const EMAIL_TEMPLATES = [
  { id: "welcome", name: "Welcome Email", desc: "Sent when a new user is approved" },
  { id: "notification", name: "Custom Notification", desc: "Free-form message to users" },
  { id: "maintenance", name: "Maintenance Notice", desc: "Scheduled downtime alert" },
  { id: "new-feature", name: "New Feature Announcement", desc: "Announce a new feature" },
  { id: "weekly-digest", name: "Weekly Digest", desc: "Weekly stats summary (auto)" },
] as const;
