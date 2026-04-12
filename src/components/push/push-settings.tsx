"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Bell, BellOff, Loader2, Send, Trash2, Monitor, Smartphone } from "lucide-react";
import {
  isPushSupported,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
} from "@/lib/push/client";
import { listMyDevices, removeDevice, testPushToAllMyDevices, type Device } from "@/lib/push/devices-actions";

interface Props {
  publicKey: string;
}

export function PushSettings({ publicKey }: Props) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "warn" | "error" | "info"; text: string } | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [testingAll, setTestingAll] = useState(false);

  const refreshDevices = useCallback(async () => {
    try {
      setDevices(await listMyDevices());
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    setSupported(isPushSupported());
    if ("Notification" in window) setPermission(Notification.permission);
    getCurrentSubscription()
      .then((s) => setSubscribed(!!s))
      .catch(() => setSubscribed(false));
    refreshDevices();
  }, [refreshDevices]);

  async function handleToggle() {
    setLoading(true);
    setMsg(null);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
        setMsg({ type: "info", text: "Push notifications disabled on this device." });
      } else {
        if (!publicKey) throw new Error("Push notifications are not configured on the server yet.");
        await subscribeToPush(publicKey);
        setSubscribed(true);
        setPermission("granted");
        setMsg({ type: "success", text: "Push notifications enabled. You'll now receive reminders even when the app is closed." });
      }
      await refreshDevices();
    } catch (err) {
      setMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    }
    setLoading(false);
  }

  async function handleTestAll() {
    setTestingAll(true);
    setMsg(null);
    try {
      const res = await testPushToAllMyDevices();
      if (res.sent === 0) {
        setMsg({ type: "warn", text: "No subscribed devices to test." });
      } else {
        setMsg({
          type: "success",
          text: `Sent to ${res.sent} device(s). Check every phone/laptop/tablet where you enabled push. ${res.failed > 0 ? `${res.failed} failed.` : ""}${res.removed > 0 ? ` ${res.removed} stale subscription(s) cleaned up.` : ""}`,
        });
      }
      await refreshDevices();
    } catch (err) {
      setMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Test failed",
      });
    }
    setTestingAll(false);
  }

  async function handleRemoveDevice(id: string) {
    if (!confirm("Remove this device? You'll stop getting notifications on it.")) return;
    try {
      await removeDevice(id);
      await refreshDevices();
    } catch {
      /* silent */
    }
  }

  async function handleTest() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await sendTestPush();
      if (res.sent > 0) {
        setMsg({ type: "success", text: `Test notification sent to ${res.sent} device(s). Check your phone/notification center.` });
      } else {
        setMsg({ type: "warn", text: `No subscriptions found. Enable push first.` });
      }
    } catch (err) {
      setMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Test failed",
      });
    }
    setLoading(false);
  }

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellOff className="h-4 w-4" /> Push notifications</CardTitle>
          <CardDescription>Get reminders and updates even when Trackify is closed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert type="warn">
            This browser doesn&apos;t support web push notifications. Try Chrome, Edge, or Firefox on desktop, or Chrome on Android. iOS requires iOS 16.4+ with Trackify installed to the home screen.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const permissionDenied = permission === "denied";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {subscribed ? <Bell className="h-4 w-4 text-indigo-600" /> : <BellOff className="h-4 w-4" />}
          Push notifications
        </CardTitle>
        <CardDescription>
          Get reminders and updates on your phone even when Trackify is closed. Install Trackify to your home screen on Android for the best experience.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {permissionDenied && (
          <Alert type="error">
            You&apos;ve blocked notifications for this site. To enable them, click the lock icon in your browser&apos;s address bar and allow notifications.
          </Alert>
        )}

        {msg && <Alert type={msg.type}>{msg.text}</Alert>}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={handleToggle} disabled={loading || permissionDenied}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : subscribed ? <BellOff className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
            {subscribed ? "Disable on this device" : "Enable push notifications"}
          </Button>
          {subscribed && (
            <Button type="button" variant="outline" onClick={handleTest} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send test notification
            </Button>
          )}
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Status:{" "}
          <span className={subscribed ? "text-indigo-600 dark:text-indigo-400 font-medium" : ""}>
            {subscribed ? "Subscribed on this device" : "Not subscribed"}
          </span>
          {" · "}Browser permission: <span className="font-medium">{permission}</span>
        </p>

        {/* Connected Devices */}
        {devices.length > 0 && (
          <div className="mt-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Connected devices ({devices.length})
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Reminders fire on every device listed here.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestAll}
                disabled={testingAll || loading}
              >
                {testingAll ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Test all devices
              </Button>
            </div>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {devices.map((d) => {
                const isMobile = /Android|iOS/.test(d.label);
                const DeviceIcon = isMobile ? Smartphone : Monitor;
                return (
                  <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <DeviceIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-800 dark:text-zinc-200">
                          {d.label}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Added {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                          {" · "}last used {formatDistanceToNow(new Date(d.last_used_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDevice(d.id)}
                      className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                      title="Remove this device"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
