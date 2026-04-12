"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Plus,
  Trash2,
  Power,
  PowerOff,
  ChevronDown,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createAutomation,
  getAutomations,
  toggleAutomation,
  deleteAutomation,
} from "@/lib/tasks/advanced-actions";
import type {
  TaskAutomation,
  AutomationTriggerType,
  AutomationActionType,
  AutomationTriggerConfig,
  AutomationActionConfig,
} from "@/lib/types/advanced-tasks";
import type { TaskStatus } from "@/lib/types/database";

interface TaskAutomationsProps {
  workspaceId: string;
}

const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  status_change: "Status changes",
  due_date_passed: "Due date passes",
  assigned: "Task is assigned",
  created: "Task is created",
};

const ACTION_LABELS: Record<AutomationActionType, string> = {
  change_status: "Change status",
  assign: "Assign to user",
  notify: "Send notification",
  move_column: "Move to column",
};

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

export function TaskAutomations({ workspaceId }: TaskAutomationsProps) {
  const [automations, setAutomations] = useState<TaskAutomation[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] =
    useState<AutomationTriggerType>("status_change");
  const [actionType, setActionType] =
    useState<AutomationActionType>("change_status");
  const [triggerConfig, setTriggerConfig] = useState<AutomationTriggerConfig>(
    {}
  );
  const [actionConfig, setActionConfig] = useState<AutomationActionConfig>({});

  const loadAutomations = useCallback(async () => {
    try {
      const data = await getAutomations(workspaceId);
      setAutomations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadAutomations();
  }, [loadAutomations]);

  function resetForm() {
    setName("");
    setTriggerType("status_change");
    setActionType("change_status");
    setTriggerConfig({});
    setActionConfig({});
    setShowCreate(false);
  }

  function handleCreate() {
    if (!name.trim()) return;

    startTransition(async () => {
      try {
        await createAutomation(workspaceId, {
          name: name.trim(),
          trigger_type: triggerType,
          trigger_config: triggerConfig,
          action_type: actionType,
          action_config: actionConfig,
        });
        resetForm();
        await loadAutomations();
      } catch {
        // ignore
      }
    });
  }

  function handleToggle(automationId: string, isActive: boolean) {
    startTransition(async () => {
      try {
        await toggleAutomation(automationId, !isActive);
        await loadAutomations();
      } catch {
        // ignore
      }
    });
  }

  function handleDelete(automationId: string) {
    startTransition(async () => {
      try {
        await deleteAutomation(automationId);
        await loadAutomations();
      } catch {
        // ignore
      }
    });
  }

  function describeTrigger(a: TaskAutomation): string {
    const cfg = a.trigger_config;
    switch (a.trigger_type) {
      case "status_change":
        if (cfg.from_status && cfg.to_status)
          return `When status changes from "${cfg.from_status}" to "${cfg.to_status}"`;
        if (cfg.to_status)
          return `When status changes to "${cfg.to_status}"`;
        return "When status changes";
      case "due_date_passed":
        return "When the due date passes";
      case "assigned":
        return "When a task is assigned";
      case "created":
        return "When a task is created";
      default:
        return a.trigger_type;
    }
  }

  function describeAction(a: TaskAutomation): string {
    const cfg = a.action_config;
    switch (a.action_type) {
      case "change_status":
        return cfg.target_status
          ? `Set status to "${cfg.target_status}"`
          : "Change status";
      case "assign":
        return cfg.assign_to ? `Assign to user` : "Assign";
      case "move_column":
        return "Move to board column";
      case "notify":
        return cfg.message ? `Notify: "${cfg.message}"` : "Send notification";
      default:
        return a.action_type;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading automations...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Task Automations
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Automate repetitive task actions with rules
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-2 h-4 w-4" />
          New Automation
        </Button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create Automation</CardTitle>
                <CardDescription>
                  Define a trigger and an action
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Name */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Auto-complete on Done column"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Trigger */}
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      When (Trigger)
                    </h4>
                    <Select
                      value={triggerType}
                      onValueChange={(v) => {
                        setTriggerType(v as AutomationTriggerType);
                        setTriggerConfig({});
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Trigger config based on type */}
                    {triggerType === "status_change" && (
                      <div className="space-y-2">
                        <Select
                          value={triggerConfig.from_status ?? "__any__"}
                          onValueChange={(v) =>
                            setTriggerConfig({
                              ...triggerConfig,
                              from_status: (v === "__any__"
                                ? undefined
                                : (v as TaskStatus)),
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__any__">From any status</SelectItem>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                From: {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={triggerConfig.to_status ?? "__any__"}
                          onValueChange={(v) =>
                            setTriggerConfig({
                              ...triggerConfig,
                              to_status: (v === "__any__"
                                ? undefined
                                : (v as TaskStatus)),
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__any__">To any status</SelectItem>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                To: {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />
                      Then (Action)
                    </h4>
                    <Select
                      value={actionType}
                      onValueChange={(v) => {
                        setActionType(v as AutomationActionType);
                        setActionConfig({});
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ACTION_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Action config based on type */}
                    {actionType === "change_status" && (
                      <Select
                        value={actionConfig.target_status ?? ""}
                        onValueChange={(v) =>
                          setActionConfig({
                            ...actionConfig,
                            target_status: v as TaskStatus,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select target status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {actionType === "notify" && (
                      <input
                        type="text"
                        value={actionConfig.message ?? ""}
                        onChange={(e) =>
                          setActionConfig({
                            ...actionConfig,
                            message: e.target.value,
                          })
                        }
                        placeholder="Notification message..."
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    )}

                    {actionType === "assign" && (
                      <input
                        type="text"
                        value={actionConfig.assign_to ?? ""}
                        onChange={(e) =>
                          setActionConfig({
                            ...actionConfig,
                            assign_to: e.target.value,
                          })
                        }
                        placeholder="User ID to assign to..."
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    )}

                    {actionType === "move_column" && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={actionConfig.board_id ?? ""}
                          onChange={(e) =>
                            setActionConfig({
                              ...actionConfig,
                              board_id: e.target.value,
                            })
                          }
                          placeholder="Board ID..."
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                        <input
                          type="text"
                          value={actionConfig.column_id ?? ""}
                          onChange={(e) =>
                            setActionConfig({
                              ...actionConfig,
                              column_id: e.target.value,
                            })
                          }
                          placeholder="Column ID..."
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={handleCreate}
                    disabled={isPending || !name.trim()}
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="mr-2 h-4 w-4" />
                    )}
                    Create Automation
                  </Button>
                  <Button variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Automations list */}
      {automations.length > 0 ? (
        <div className="space-y-3">
          {automations.map((automation, index) => (
            <motion.div
              key={automation.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={cn(
                  "transition-opacity",
                  !automation.is_active && "opacity-50"
                )}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  {/* Toggle */}
                  <button
                    onClick={() =>
                      handleToggle(automation.id, automation.is_active)
                    }
                    disabled={isPending}
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                      automation.is_active
                        ? "bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-500"
                    )}
                  >
                    {automation.is_active ? (
                      <Power className="h-4 w-4" />
                    ) : (
                      <PowerOff className="h-4 w-4" />
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                      {automation.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {describeTrigger(automation)}
                      </span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        {describeAction(automation)}
                      </span>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(automation.id)}
                    disabled={isPending}
                    className="shrink-0 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        !showCreate && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Zap className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No automations yet. Create one to automate repetitive task
                actions.
              </p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
