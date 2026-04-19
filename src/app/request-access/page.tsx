"use client";

import { useState } from "react";
import { submitWhitelistRequest } from "@/lib/feedback/actions";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function RequestAccessPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email is required"); return; }
    setLoading(true);
    setError(null);

    try {
      await submitWhitelistRequest({
        email: email.trim(),
        name: name.trim() || undefined,
        reason: reason.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 py-8 sm:items-center dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
        <div className="w-full max-w-md text-center">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Request submitted!</h2>
          <p className="mt-2 text-zinc-500">
            The admin has been notified and will review your request shortly.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm text-indigo-600 hover:underline dark:text-indigo-400">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
        <div className="mb-6 text-center">
          <Image src="/icons/icon-192.png" alt="Trackify" width={40} height={40} className="mx-auto mb-3 rounded-xl" />
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Request Access</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Trackify is invite-only. Submit your request and we&apos;ll get back to you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email *
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50"
            />
          </div>

          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Your name <span className="text-zinc-400">(optional)</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50"
            />
          </div>

          <div>
            <label htmlFor="reason" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Why do you want access? <span className="text-zinc-400">(optional)</span>
            </label>
            <textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell us a bit about yourself and how you'd use Trackify..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-50"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Request Access"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-400">
          Already have access?{" "}
          <Link href="/login" className="text-indigo-600 hover:underline dark:text-indigo-400">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
