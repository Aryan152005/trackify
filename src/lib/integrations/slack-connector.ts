"use server";

import { createClient } from "@/lib/supabase/server";
import type { SlackConfig } from "./types";

// ---------------------------------------------------------------------------
// Slack connector
// ---------------------------------------------------------------------------

/**
 * Send a message to Slack via an integration's configured webhook URL.
 */
export async function sendSlackMessage(
  integrationId: string,
  channel: string | undefined,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: integration, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("id", integrationId)
    .eq("type", "slack")
    .single();

  if (error || !integration) {
    return { success: false, error: "Slack integration not found" };
  }

  const config = integration.config as unknown as SlackConfig;
  if (!config.webhook_url) {
    return { success: false, error: "No webhook URL configured" };
  }

  try {
    const body: Record<string, unknown> = { text: message };
    if (channel) body.channel = channel;

    const res = await fetch(config.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      // Update last_synced_at
      await supabase
        .from("integrations")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", integrationId);

      // Log success
      await supabase.from("integration_logs").insert({
        integration_id: integrationId,
        workspace_id: integration.workspace_id,
        event_type: "webhook_sent",
        status: "success",
        payload: { channel, message: message.substring(0, 200) },
      });

      return { success: true };
    }

    const errorText = await res.text().catch(() => res.statusText);
    return { success: false, error: `Slack returned ${res.status}: ${errorText}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reach Slack",
    };
  }
}

/**
 * Format a task as a Slack Block Kit message.
 */
export function formatTaskNotification(task: {
  title: string;
  status?: string;
  priority?: string;
  assigned_to_name?: string;
  due_date?: string;
  url?: string;
}): Record<string, unknown> {
  const fields: Array<{ type: string; text: string }> = [];

  if (task.status) {
    fields.push({ type: "mrkdwn", text: `*Status:* ${task.status}` });
  }
  if (task.priority) {
    fields.push({ type: "mrkdwn", text: `*Priority:* ${task.priority}` });
  }
  if (task.assigned_to_name) {
    fields.push({
      type: "mrkdwn",
      text: `*Assigned to:* ${task.assigned_to_name}`,
    });
  }
  if (task.due_date) {
    fields.push({ type: "mrkdwn", text: `*Due:* ${task.due_date}` });
  }

  const blocks: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: { type: "plain_text", text: `Task: ${task.title}`, emoji: true },
    },
  ];

  if (fields.length > 0) {
    blocks.push({ type: "section", fields });
  }

  if (task.url) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Task" },
          url: task.url,
          style: "primary",
        },
      ],
    });
  }

  return { blocks };
}

/**
 * Format a work entry as a Slack message.
 */
export function formatEntryNotification(entry: {
  user_name: string;
  date: string;
  work_done?: string;
  learnings?: string;
  blockers?: string;
  url?: string;
}): Record<string, unknown> {
  const sections: Array<Record<string, unknown>> = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Work Entry by ${entry.user_name} - ${entry.date}`,
        emoji: true,
      },
    },
  ];

  if (entry.work_done) {
    sections.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*What was done:*\n${entry.work_done.substring(0, 500)}`,
      },
    });
  }

  if (entry.learnings) {
    sections.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Learnings:*\n${entry.learnings.substring(0, 500)}`,
      },
    });
  }

  if (entry.blockers) {
    sections.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:warning: *Blockers:*\n${entry.blockers.substring(0, 500)}`,
      },
    });
  }

  if (entry.url) {
    sections.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Entry" },
          url: entry.url,
        },
      ],
    });
  }

  return { blocks: sections };
}
