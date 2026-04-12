"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  FileText, CheckSquare, Columns3, StickyNote, BarChart3,
  Bell, Users, Brain, Calendar, FileDown, Pencil, Shield,
  Keyboard, HelpCircle, Sparkles, Mail, Activity, Rocket,
} from "lucide-react";

const guides = [
  {
    category: "Getting Started",
    items: [
      { icon: FileText, title: "Log Your Work", steps: ["Go to Entries > + New Entry", "Fill in what you worked on, hours, and a productivity score", "Add tags to categorize your work", "Upload photos as proof if needed"] },
      { icon: CheckSquare, title: "Create Tasks", steps: ["Go to Tasks > New Task", "Set a title, priority (low/medium/high/urgent), and due date", "Track status: pending > in-progress > done", "View tasks on Kanban boards for a visual overview"] },
      { icon: StickyNote, title: "Write Notes", steps: ["Go to Notes > + New Page", "Use the rich editor — type / for block commands", "Add headings, lists, checkboxes, code blocks, and more", "Notes auto-save as you type"] },
    ],
  },
  {
    category: "Organize & Visualize",
    items: [
      { icon: Columns3, title: "Kanban Boards", steps: ["Go to Boards > Create Board", "Add columns (e.g. To Do, In Progress, Done)", "Create task cards in each column", "Drag and drop to move tasks between columns"] },
      { icon: Brain, title: "Mind Maps", steps: ["Go to Mind Maps > New Mind Map", "Click 'Add Node' to create ideas", "Drag between nodes to create connections", "Use Auto Layout to organize the view"] },
      { icon: Calendar, title: "Calendar & Reminders", steps: ["Calendar shows all your events, deadlines, and reminders", "Click + Add Event to create new events", "Set reminders with notification times", "Reminders send push notifications to your phone"] },
    ],
  },
  {
    category: "Collaborate",
    items: [
      { icon: Users, title: "Share & Comment", steps: ["Open any page, board, or drawing", "Click the Share button in the toolbar", "Choose permission level: view, comment, or edit", "Copy the link and send it to teammates"] },
      { icon: Bell, title: "Mentions & Notifications", steps: ["In any comment, type @ to mention a teammate", "They'll get a notification in their mentions popover", "Click the bell icon in the nav to see notifications", "Reminders also send push notifications to your phone"] },
      { icon: Shield, title: "Workspace & Members", steps: ["Go to Workspace Settings > Members", "Invite team members by email", "Assign roles: viewer, editor, or admin", "Each role has different permissions"] },
    ],
  },
  {
    category: "Analyze & Export",
    items: [
      { icon: BarChart3, title: "Analytics", steps: ["Go to Analytics for charts and insights", "See productivity trends, task completion rates", "Track time distribution across tags", "View heatmaps of your most active days"] },
      { icon: FileDown, title: "Reports", steps: ["Go to Reports to generate exports", "Select a date range", "Export as PDF, Word (DOCX), or Excel", "Reports include all entries, stats, and summaries"] },
    ],
  },
  {
    category: "Smart & Automated",
    items: [
      { icon: Sparkles, title: "Smart Mindmap", steps: ["Open Mind Maps > Smart Mindmap", "Auto-generated from your tasks, reminders, entries, notes", "Hover a node to dim others; see only its connections", "Click a suggestion to auto-link related items (set due date, create reminder, etc.)"] },
      { icon: Bell, title: "Push Notifications", steps: ["Click Enable notifications in the banner at the top, OR go to Reminders", "Grant browser permission when asked", "Repeat on each device (laptop, phone, tablet)", "Reminders fire on ALL your devices even when the app is closed"] },
      { icon: Activity, title: "Admin · System Logs", steps: ["Admins only: go to Admin > System Logs", "Filter by service, level (error/warn/info), tag, time range, or search", "CSV export of any filtered view", "Live tail toggle streams events in realtime"] },
    ],
  },
  {
    category: "Pro Tips",
    items: [
      { icon: Keyboard, title: "Keyboard Shortcuts", steps: ["Press Cmd/Ctrl + K to open the command palette", "Search for any page, task, or board instantly", "Use Ctrl+Enter to submit comments", "Press / in the notes editor for block commands"] },
      { icon: Pencil, title: "Drawings", steps: ["Go to Drawings to create freeform canvases", "Excalidraw-powered: shapes, arrows, text, colors, freehand", "Great for diagrams, wireframes, sketches", "Auto-saves as you draw"] },
      { icon: Mail, title: "Manual Email Sending", steps: ["Open any Whitelist entry or Invite > Preview", "Click Copy HTML — preserves logo, buttons, design", "Paste into Gmail / Outlook / Apple Mail compose", "Subject and recipient have their own Copy buttons"] },
    ],
  },
];

export default function HelpPage() {
  function restartTour() {
    window.dispatchEvent(new CustomEvent("trackify:open-tour"));
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Help & Guide"
        description="Learn how to get the most out of Trackify"
        actions={
          <Button onClick={restartTour} variant="outline">
            <Rocket className="mr-2 h-4 w-4" />
            Restart walkthrough
          </Button>
        }
      />

      {/* Hero — interactive tour */}
      <Card className="overflow-hidden border-indigo-200 dark:border-indigo-900/50">
        <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Interactive walkthrough</h2>
                <p className="text-sm text-white/85">
                  A 2-minute tour through every feature. Start here if you&apos;re new.
                </p>
              </div>
            </div>
            <Button onClick={restartTour} className="bg-white text-indigo-600 hover:bg-white/90">
              <Rocket className="mr-2 h-4 w-4" />
              Start tour
            </Button>
          </div>
        </div>
      </Card>

      {guides.map((section) => (
        <div key={section.category}>
          <h2 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            {section.category}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => (
              <Card key={item.title}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                      <item.icon className="h-4.5 w-4.5" />
                    </div>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-1.5">
                    {item.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Card>
        <CardContent className="py-8 text-center">
          <HelpCircle className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
          <p className="font-medium text-zinc-700 dark:text-zinc-300">Still need help?</p>
          <p className="mt-1 text-sm text-zinc-500">
            Use the feedback form in Settings to send us your questions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
