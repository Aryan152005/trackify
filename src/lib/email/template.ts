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

// Platform Invitation — marketing email to invite a user to try Trackify.
// Features a gradient hero, feature grid, testimonial-style quote, and a prominent CTA.
export function platformInviteEmail(
  recipientName: string,
  inviterName: string | undefined,
  ctaUrl: string
): { subject: string; html: string } {
  const appUrl = getAppUrl();
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi there,";
  const from = inviterName ? `${inviterName} thought you'd love it.` : "We thought you'd love it.";
  const subjectLine = inviterName
    ? `${inviterName} invited you to try ${APP_NAME}`
    : `You're invited to try ${APP_NAME} — the smart work tracker`;

  return {
    subject: subjectLine,
    html: emailLayout(`
      <!-- Hero -->
      <div style="margin:-32px -32px 24px;padding:40px 32px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%);text-align:center">
        <div style="display:inline-block;padding:6px 14px;background:rgba(255,255,255,0.18);border-radius:999px;margin-bottom:14px">
          <span style="color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase">✨ You're Invited</span>
        </div>
        <h1 style="margin:0 0 8px;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.6px;line-height:1.2">
          Your work, finally in one place
        </h1>
        <p style="margin:0;color:rgba(255,255,255,0.92);font-size:15px;line-height:1.5;max-width:420px;margin-left:auto;margin-right:auto">
          ${APP_NAME} is the all-in-one workspace for tracking work, managing tasks, and shipping faster.
        </p>
      </div>

      <p style="margin:0 0 12px;color:#18181b;font-size:16px;font-weight:600">${greeting}</p>
      <p style="margin:0 0 20px;color:#52525b;font-size:15px;line-height:1.7">
        ${from} ${APP_NAME} brings together everything you need to get work done — without the chaos of 10 different apps. It's currently in private beta, and we'd love for you to try it.
      </p>

      <!-- Feature grid -->
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px">
        <tr>
          <td style="padding:0 8px 12px 0;width:50%;vertical-align:top">
            <div style="padding:14px;background:#f4f4ff;border-radius:10px;border-left:3px solid #6366f1">
              <p style="margin:0 0 4px;color:#6366f1;font-size:13px;font-weight:700">📊 Smart Tracking</p>
              <p style="margin:0;color:#52525b;font-size:13px;line-height:1.5">Daily entries with productivity scores and streaks.</p>
            </div>
          </td>
          <td style="padding:0 0 12px 8px;width:50%;vertical-align:top">
            <div style="padding:14px;background:#f0fdf4;border-radius:10px;border-left:3px solid #10b981">
              <p style="margin:0 0 4px;color:#10b981;font-size:13px;font-weight:700">✅ Kanban Boards</p>
              <p style="margin:0;color:#52525b;font-size:13px;line-height:1.5">Drag-and-drop task management that feels great.</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 8px 0 0;width:50%;vertical-align:top">
            <div style="padding:14px;background:#faf5ff;border-radius:10px;border-left:3px solid #a855f7">
              <p style="margin:0 0 4px;color:#a855f7;font-size:13px;font-weight:700">📝 Rich Notes</p>
              <p style="margin:0;color:#52525b;font-size:13px;line-height:1.5">Notion-style block editor for docs &amp; briefs.</p>
            </div>
          </td>
          <td style="padding:0 0 0 8px;width:50%;vertical-align:top">
            <div style="padding:14px;background:#fff7ed;border-radius:10px;border-left:3px solid #f59e0b">
              <p style="margin:0 0 4px;color:#f59e0b;font-size:13px;font-weight:700">📈 Analytics</p>
              <p style="margin:0;color:#52525b;font-size:13px;line-height:1.5">See trends, export reports, stay on track.</p>
            </div>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <div style="text-align:center;margin:0 0 20px">
        ${buttonHtml("Claim Your Invite →", ctaUrl)}
        <p style="margin:0;color:#a1a1aa;font-size:12px">Free to try · No credit card · Ready in 30 seconds</p>
      </div>

      <!-- Testimonial strip -->
      <div style="margin:24px 0 12px;padding:16px 18px;background:#fafafa;border-radius:10px;border:1px solid #e4e4e7">
        <p style="margin:0 0 6px;color:#18181b;font-size:14px;font-style:italic;line-height:1.55">
          &ldquo;Finally an app that replaced my Notion + Trello + spreadsheets. I'm 2x more organized.&rdquo;
        </p>
        <p style="margin:0;color:#71717a;font-size:12px">— Early beta user</p>
      </div>

      <p style="margin:16px 0 0;color:#a1a1aa;font-size:12px;line-height:1.6">
        Prefer to look around first? <a href="${appUrl}" style="color:#6366f1;text-decoration:none">Visit ${APP_NAME}</a> ·
        Not interested? No worries — you won't hear from us again.
      </p>
    `, `${inviterName || "Someone"} invited you to try ${APP_NAME}`),
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
