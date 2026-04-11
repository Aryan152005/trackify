"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminCharts } from "@/components/admin/admin-charts";
import { addToWhitelist, removeFromWhitelist, approveWhitelistRequest, sendBroadcast } from "@/lib/admin/email-actions";
import {
  Users, Shield, Mail, BarChart3, MessageSquare,
  Plus, Trash2, Check, Send, Loader2, X,
} from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "whitelist", label: "Whitelist", icon: Shield },
  { id: "email", label: "Send Email", icon: Mail },
  { id: "requests", label: "Access Requests", icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface AdminTabsProps {
  users: {
    id: string; name: string; email: string; avatarUrl: string | null;
    joinedAt: string; lastSignIn: string | null;
    entryCount: number; taskStats: { total: number; done: number }; pageCount: number;
  }[];
  whitelist: { email: string; created_at: string }[];
  whitelistRequests: { id: string; email: string; name: string | null; reason: string | null; status: string; created_at: string }[];
  dailyActivity: { date: string; entries: number; tasks: number; avgScore: number }[];
  taskAnalytics: { statuses: Record<string, number>; priorities: Record<string, number>; avgCompletionHours: number; total: number };
  entryAnalytics: { statuses: Record<string, number>; avgScore: number; totalDaysTracked: number; activeUsers: number; total: number };
}

export function AdminTabs({ users, whitelist: initialWhitelist, whitelistRequests: initialRequests, dailyActivity, taskAnalytics, entryAnalytics }: AdminTabsProps) {
  const [tab, setTab] = useState<TabId>("overview");
  const [whitelist, setWhitelist] = useState(initialWhitelist);
  const [requests, setRequests] = useState(initialRequests);
  const router = useRouter();

  // Whitelist state
  const [newEmail, setNewEmail] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [addingEmail, setAddingEmail] = useState(false);

  // Email state
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleAddWhitelist(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAddingEmail(true);
    try {
      await addToWhitelist(newEmail, sendInvite);
      setWhitelist((prev) => [{ email: newEmail.toLowerCase().trim(), created_at: new Date().toISOString() }, ...prev]);
      setNewEmail("");
    } catch { /* silent */ }
    setAddingEmail(false);
  }

  async function handleRemoveWhitelist(email: string) {
    setActionLoading(email);
    try {
      await removeFromWhitelist(email);
      setWhitelist((prev) => prev.filter((w) => w.email !== email));
    } catch { /* silent */ }
    setActionLoading(null);
  }

  async function handleApproveRequest(requestId: string) {
    setActionLoading(requestId);
    try {
      const result = await approveWhitelistRequest(requestId);
      setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: "approved" } : r));
      setWhitelist((prev) => [{ email: result.email, created_at: new Date().toISOString() }, ...prev]);
    } catch { /* silent */ }
    setActionLoading(null);
  }

  async function handleSendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!emailSubject.trim() || !emailMessage.trim()) return;
    setSendingEmail(true);
    setEmailResult(null);
    try {
      const result = await sendBroadcast(emailSubject, emailMessage);
      setEmailResult(`Sent to ${result.sent} user(s). ${result.failed > 0 ? `${result.failed} failed.` : ""}`);
      setEmailSubject("");
      setEmailMessage("");
    } catch (err) {
      setEmailResult(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setSendingEmail(false);
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap transition ${
              tab === t.id
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.id === "requests" && requests.filter((r) => r.status === "pending").length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {requests.filter((r) => r.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <AdminCharts
          dailyActivity={dailyActivity}
          taskStatuses={taskAnalytics.statuses}
          taskPriorities={taskAnalytics.priorities}
          entryStatuses={entryAnalytics.statuses}
        />
      )}

      {/* Users Tab */}
      {tab === "users" && (
        <Card>
          <CardHeader>
            <CardTitle>All Users ({users.length})</CardTitle>
            <CardDescription>Click a user to view their detailed activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                    <th className="pb-3 font-medium text-zinc-500">Name</th>
                    <th className="pb-3 font-medium text-zinc-500">Email</th>
                    <th className="pb-3 font-medium text-zinc-500">Entries</th>
                    <th className="pb-3 font-medium text-zinc-500">Tasks</th>
                    <th className="pb-3 font-medium text-zinc-500">Last Active</th>
                    <th className="pb-3 font-medium text-zinc-500">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800/50">
                      <td className="py-3">
                        <Link href={`/admin/users/${u.id}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                          {u.name}
                        </Link>
                      </td>
                      <td className="py-3 text-zinc-500">{u.email}</td>
                      <td className="py-3">{u.entryCount}</td>
                      <td className="py-3">{u.taskStats.done}/{u.taskStats.total}</td>
                      <td className="py-3 text-zinc-400 text-xs">
                        {u.lastSignIn ? format(new Date(u.lastSignIn), "MMM d, HH:mm") : "Never"}
                      </td>
                      <td className="py-3 text-zinc-400 text-xs">{format(new Date(u.joinedAt), "MMM d, yyyy")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Whitelist Tab */}
      {tab === "whitelist" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add to Whitelist</CardTitle>
              <CardDescription>Whitelist an email to allow signup. Optionally send an invite email.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddWhitelist} className="flex flex-wrap gap-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} className="rounded" />
                  Send invite email
                </label>
                <Button type="submit" disabled={addingEmail} size="sm">
                  {addingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Whitelisted Emails ({whitelist.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {whitelist.map((w) => (
                  <div key={w.email} className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{w.email}</p>
                      <p className="text-xs text-zinc-400">Added {format(new Date(w.created_at), "MMM d, yyyy")}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveWhitelist(w.email)}
                      disabled={actionLoading === w.email}
                      className="rounded p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    >
                      {actionLoading === w.email ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Email Tab */}
      {tab === "email" && (
        <Card>
          <CardHeader>
            <CardTitle>Send Email to All Users</CardTitle>
            <CardDescription>Broadcast a notification, announcement, or maintenance notice to every user.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="e.g. New Feature: Mind Maps are here!"
                  required
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Message</label>
                <textarea
                  rows={5}
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder="Write your message here. HTML is not supported — plain text only."
                  required
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              {emailResult && (
                <div className={`rounded-lg px-3 py-2 text-sm ${emailResult.startsWith("Failed") ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"}`}>
                  {emailResult}
                </div>
              )}
              <Button type="submit" disabled={sendingEmail}>
                {sendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send to {users.length} user(s)
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Access Requests Tab */}
      {tab === "requests" && (
        <Card>
          <CardHeader>
            <CardTitle>Access Requests</CardTitle>
            <CardDescription>People who submitted the &quot;Request Access&quot; form. Approve to auto-whitelist and send invite.</CardDescription>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-400">No access requests yet</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-start justify-between rounded-lg border border-zinc-100 px-4 py-3 dark:border-zinc-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">{r.email}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          r.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : r.status === "denied" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}>
                          {r.status}
                        </span>
                      </div>
                      {r.name && <p className="mt-0.5 text-xs text-zinc-500">Name: {r.name}</p>}
                      {r.reason && <p className="mt-0.5 text-xs text-zinc-400">&quot;{r.reason}&quot;</p>}
                      <p className="mt-1 text-[11px] text-zinc-300">{format(new Date(r.created_at), "MMM d, yyyy HH:mm")}</p>
                    </div>
                    {r.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => handleApproveRequest(r.id)}
                        disabled={actionLoading === r.id}
                      >
                        {actionLoading === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                        Approve
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
