// ---------------------------------------------------------------------------
// Integration types
// ---------------------------------------------------------------------------

export type IntegrationType =
  | "slack"
  | "github"
  | "webhook"
  | "email"
  | "google_drive";

export type IntegrationLogEventType =
  | "sync"
  | "webhook_received"
  | "webhook_sent"
  | "error";

export type IntegrationLogStatus = "success" | "error" | "pending";

// ---------------------------------------------------------------------------
// Per-type config shapes
// ---------------------------------------------------------------------------

export interface SlackConfig {
  webhook_url: string;
  default_channel?: string;
}

export interface GitHubConfig {
  webhook_secret: string;
  events: string[]; // e.g. ["push", "pull_request"]
  repository?: string;
}

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
}

export interface EmailConfig {
  recipients: string[];
  frequency: "instant" | "daily" | "weekly";
}

export interface GoogleDriveConfig {
  folder_id?: string;
  access_token?: string;
  refresh_token?: string;
}

export type IntegrationConfig =
  | SlackConfig
  | GitHubConfig
  | WebhookConfig
  | EmailConfig
  | GoogleDriveConfig;

// ---------------------------------------------------------------------------
// Database row types
// ---------------------------------------------------------------------------

export interface Integration {
  id: string;
  workspace_id: string;
  type: IntegrationType;
  name: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_by: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationLog {
  id: string;
  integration_id: string;
  workspace_id: string;
  event_type: IntegrationLogEventType;
  payload: Record<string, unknown>;
  status: IntegrationLogStatus;
  error_message: string | null;
  created_at: string;
}

export interface WebhookEndpoint {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Available webhook event types (outgoing)
// ---------------------------------------------------------------------------

export const WEBHOOK_EVENT_TYPES = [
  "task.created",
  "task.updated",
  "task.completed",
  "entry.created",
  "entry.updated",
  "board.updated",
  "member.joined",
  "member.left",
  "comment.added",
  "reminder.due",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Integration catalog for the hub UI
// ---------------------------------------------------------------------------

export interface IntegrationCatalogItem {
  type: IntegrationType;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color class
  configFields: ConfigField[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "url" | "email" | "select" | "multi-select" | "textarea";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

export const INTEGRATION_CATALOG: IntegrationCatalogItem[] = [
  {
    type: "slack",
    name: "Slack",
    description:
      "Send notifications and updates to your Slack workspace channels.",
    icon: "MessageSquare",
    color: "bg-[#4A154B]",
    configFields: [
      {
        key: "webhook_url",
        label: "Webhook URL",
        type: "url",
        placeholder: "https://hooks.slack.com/services/...",
        required: true,
      },
      {
        key: "default_channel",
        label: "Default Channel",
        type: "text",
        placeholder: "#general",
      },
    ],
  },
  {
    type: "github",
    name: "GitHub",
    description:
      "Receive webhook events from GitHub repositories (pushes, PRs, issues).",
    icon: "Github",
    color: "bg-zinc-900 dark:bg-zinc-100",
    configFields: [
      {
        key: "webhook_secret",
        label: "Webhook Secret",
        type: "text",
        placeholder: "Auto-generated secret for verifying payloads",
        required: true,
      },
      {
        key: "repository",
        label: "Repository",
        type: "text",
        placeholder: "owner/repo",
      },
      {
        key: "events",
        label: "Events",
        type: "multi-select",
        options: [
          { value: "push", label: "Push" },
          { value: "pull_request", label: "Pull Request" },
          { value: "issues", label: "Issues" },
          { value: "release", label: "Release" },
          { value: "workflow_run", label: "Workflow Run" },
        ],
      },
    ],
  },
  {
    type: "webhook",
    name: "Webhook",
    description:
      "Send or receive generic JSON webhook payloads for custom integrations.",
    icon: "Webhook",
    color: "bg-indigo-600",
    configFields: [
      {
        key: "url",
        label: "Endpoint URL",
        type: "url",
        placeholder: "https://your-service.com/webhook",
        required: true,
      },
    ],
  },
  {
    type: "email",
    name: "Email",
    description:
      "Send email notifications and daily/weekly digest summaries.",
    icon: "Mail",
    color: "bg-blue-600",
    configFields: [
      {
        key: "recipients",
        label: "Recipients (comma-separated)",
        type: "textarea",
        placeholder: "user@example.com, another@example.com",
        required: true,
      },
      {
        key: "frequency",
        label: "Digest Frequency",
        type: "select",
        options: [
          { value: "instant", label: "Instant" },
          { value: "daily", label: "Daily Digest" },
          { value: "weekly", label: "Weekly Digest" },
        ],
      },
    ],
  },
];
