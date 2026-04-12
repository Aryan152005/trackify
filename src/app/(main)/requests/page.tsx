"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { createRequest, respondToRequest } from "@/lib/requests/actions";
import {
  AnimatedPage,
  AnimatedList,
  AnimatedItem,
} from "@/components/ui/animated-layout";
import { RequestForm } from "@/components/requests/request-form";
import { RequestCard } from "@/components/requests/request-card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Plus, Inbox, Send } from "lucide-react";
import type { RequestWithProfiles, RequestType } from "@/lib/types/notification";

type Tab = "received" | "sent";

interface Member {
  id: string;
  name: string;
  avatar_url: string | null;
}

export default function RequestsPage() {
  const workspaceId = useWorkspaceId();
  const [tab, setTab] = useState<Tab>("received");
  const [received, setReceived] = useState<RequestWithProfiles[]>([]);
  const [sent, setSent] = useState<RequestWithProfiles[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = createClient();

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // Load requests
  const loadRequests = useCallback(async () => {
    if (!workspaceId || !userId) return;
    setLoading(true);

    const [receivedRes, sentRes] = await Promise.all([
      supabase
        .from("requests")
        .select(
          "*, from_profile:user_profiles!requests_from_user_id_fkey(name, avatar_url)"
        )
        .eq("to_user_id", userId)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("requests")
        .select(
          "*, to_profile:user_profiles!requests_to_user_id_fkey(name, avatar_url)"
        )
        .eq("from_user_id", userId)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
    ]);

    if (receivedRes.data) {
      setReceived(receivedRes.data as unknown as RequestWithProfiles[]);
    }
    if (sentRes.data) {
      setSent(sentRes.data as unknown as RequestWithProfiles[]);
    }
    setLoading(false);
  }, [workspaceId, userId]);

  // Load workspace members
  const loadMembers = useCallback(async () => {
    if (!workspaceId || !userId) return;

    const { data } = await supabase
      .from("workspace_members")
      .select("user_id, user_profiles(name, avatar_url)")
      .eq("workspace_id", workspaceId);

    if (data) {
      setMembers(
        data
          .filter((m) => m.user_id !== userId)
          .map((m) => ({
            id: m.user_id,
            name:
              (m.user_profiles as unknown as { name: string })?.name ||
              "Unknown",
            avatar_url:
              (
                m.user_profiles as unknown as { avatar_url: string | null }
              )?.avatar_url || null,
          }))
      );
    }
  }, [workspaceId, userId]);

  useEffect(() => {
    loadRequests();
    loadMembers();
  }, [loadRequests, loadMembers]);

  // Handlers
  async function handleCreate(data: {
    to_user_id: string;
    type: RequestType;
    title: string;
    description?: string;
    due_date?: string;
  }) {
    if (!workspaceId) return;
    await createRequest({ workspace_id: workspaceId, ...data });
    setShowForm(false);
    await loadRequests();
  }

  async function handleRespond(
    requestId: string,
    status: "accepted" | "declined" | "completed"
  ) {
    await respondToRequest(requestId, status);
    await loadRequests();
  }

  const activeList = tab === "received" ? received : sent;

  return (
    <AnimatedPage>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Requests"
          description="Manage requests between team members"
          actions={
            <Button onClick={() => setShowForm((v) => !v)}>
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          }
        />

        {/* New Request Form */}
        {showForm && workspaceId && (
          <RequestForm
            workspaceId={workspaceId}
            members={members}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800">
          <button
            onClick={() => setTab("received")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "received"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Inbox className="h-4 w-4" />
            Received ({received.length})
          </button>
          <button
            onClick={() => setTab("sent")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "sent"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <Send className="h-4 w-4" />
            Sent ({sent.length})
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : activeList.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 dark:text-zinc-400">
            <p className="text-lg font-medium">No {tab} requests</p>
            <p className="mt-1 text-sm">
              {tab === "received"
                ? "Requests sent to you will appear here."
                : "Requests you send will appear here."}
            </p>
          </div>
        ) : (
          <AnimatedList>
            <div className="space-y-3">
              {activeList.map((request) => (
                <AnimatedItem key={request.id}>
                  <RequestCard
                    request={request}
                    isReceived={tab === "received"}
                    onRespond={tab === "received" ? handleRespond : undefined}
                  />
                </AnimatedItem>
              ))}
            </div>
          </AnimatedList>
        )}
      </div>
    </AnimatedPage>
  );
}
