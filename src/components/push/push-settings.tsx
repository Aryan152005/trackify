"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import {
  isPushSupported,
  getCurrentSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
} from "@/lib/push/client";

interface Props {
  publicKey: string;
}

export function PushSettings({ publicKey }: Props) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "warn" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    setSupported(isPushSupported());
    if ("Notification" in window) setPermission(Notification.permission);
    getCurrentSubscription()
      .then((s) => setSubscribed(!!s))
      .catch(() => setSubscribed(false));
  }, []);

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
    } catch (err) {
      setMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    }
    setLoading(false);
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
      </CardContent>
    </Card>
  );
}
