"use server";

import { requireAdmin } from "@/lib/admin/actions";
import {
  notificationEmail,
  maintenanceEmail,
  newFeatureEmail,
  welcomeEmail,
  platformInviteEmail,
} from "@/lib/email/template";
import type { RenderedEmail } from "@/lib/admin/preview-actions";

export type TemplateId = "invite" | "notification" | "maintenance" | "new-feature" | "welcome";

export interface TemplateFields {
  invite: { recipientName: string; inviterName: string; ctaUrl: string };
  notification: { subject: string; message: string };
  maintenance: { scheduledTime: string; duration: string; details: string };
  "new-feature": { featureName: string; description: string; ctaText: string; ctaUrl: string };
  welcome: { name: string };
}

function render(id: TemplateId, fields: TemplateFields[TemplateId]) {
  switch (id) {
    case "invite": {
      const f = fields as TemplateFields["invite"];
      return platformInviteEmail(f.recipientName, f.inviterName, f.ctaUrl);
    }
    case "notification": {
      const f = fields as TemplateFields["notification"];
      return notificationEmail(f.subject, f.message);
    }
    case "maintenance": {
      const f = fields as TemplateFields["maintenance"];
      return maintenanceEmail(f.scheduledTime, f.duration, f.details);
    }
    case "new-feature": {
      const f = fields as TemplateFields["new-feature"];
      return newFeatureEmail(f.featureName, f.description, f.ctaText, f.ctaUrl);
    }
    case "welcome": {
      const f = fields as TemplateFields["welcome"];
      return welcomeEmail(f.name);
    }
  }
}

export async function renderTemplatePreview(
  id: TemplateId,
  fields: TemplateFields[TemplateId],
  previewRecipient: string
): Promise<RenderedEmail> {
  await requireAdmin();
  const tpl = render(id, fields);
  return { to: previewRecipient, subject: tpl.subject, html: tpl.html };
}
