"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const strength = useMemo(() => scorePassword(password), [password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) return setError("Email is required");
    if (!password) return setError("Password is required");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");

    setLoading(true);
    try {
      const normalizedEmail = email.toLowerCase().trim();

      const res = await fetch("/api/auth/whitelist-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password, name: name.trim() || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(humanizeRateLimit(data.error) || "Signup failed");
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password,
      });

      if (signInError) {
        setError(signInError.message || "Could not sign in. Please try logging in.");
        setLoading(false);
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-8 sm:justify-center dark:from-zinc-900 dark:via-zinc-800">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
        <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Join Trackify</h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Create your account and start getting things done
        </p>

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 rounded-lg bg-red-100 px-3 py-2.5 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Your name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              placeholder="e.g. Aryan"
              autoComplete="name"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Your email must be whitelisted
            </p>
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 pr-11 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                placeholder="At least 6 characters"
                autoComplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                aria-label={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password.length > 0 && <PasswordStrength score={strength.score} label={strength.label} />}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showPw ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 pr-9 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                placeholder="Confirm your password"
                autoComplete="new-password"
                disabled={loading}
              />
              {confirmPassword.length > 0 && confirmPassword === password && (
                <Check className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-600 hover:underline dark:text-indigo-400">
            Sign in
          </Link>
        </p>

        <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Trackify is invite-only.{" "}
          <Link href="/request-access" className="text-indigo-600 hover:underline dark:text-indigo-400">
            Request access
          </Link>
        </p>
      </div>
    </div>
  );
}

// Simple heuristic password strength (0..4): length + mixed case + digits + symbols.
function scorePassword(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  const clamped = Math.min(s, 4);
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  return { score: clamped, label: labels[clamped] };
}

function PasswordStrength({ score, label }: { score: number; label: string }) {
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-emerald-500"];
  const textColors = ["text-red-600", "text-orange-600", "text-yellow-600", "text-lime-600", "text-emerald-600"];
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition ${
              i < score ? colors[score] : "bg-zinc-200 dark:bg-zinc-700"
            }`}
          />
        ))}
      </div>
      <p className={`text-[11px] font-medium ${textColors[score]}`}>{label}</p>
    </div>
  );
}

function humanizeRateLimit(text?: string): string | undefined {
  if (!text) return text;
  return text.replace(/(\d+)s\b/g, (_m, s) => {
    const secs = parseInt(s, 10);
    if (secs < 60) return `${secs} sec`;
    const mins = Math.ceil(secs / 60);
    return mins === 1 ? "1 minute" : `${mins} minutes`;
  });
}
