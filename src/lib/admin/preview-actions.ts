"use server";

import { requireAdmin } from "@/lib/admin/actions";
import { notificationEmail, whitelistApprovedEmail } from "@/lib/email/template";

export interface RenderedEmail {
  to: string;
  subject: string;
  html: string;
}

export async function renderWhitelistApproved(
  email: string,
  name = ""
): Promise<RenderedEmail> {
  await requireAdmin();
  const tpl = whitelistApprovedEmail(name, email);
  return { to: email, subject: tpl.subject, html: tpl.html };
}

export async function renderNotification(
  email: string,
  subject: string,
  message: string
): Promise<RenderedEmail> {
  await requireAdmin();
  const tpl = notificationEmail(subject, message);
  return { to: email, subject: tpl.subject, html: tpl.html };
}
