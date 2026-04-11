"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function MotivationPage() {
  const [quote, setQuote] = useState("");
  const [reflection, setReflection] = useState("");
  const [gratitude, setGratitude] = useState("");
  const [mood, setMood] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<any>(null);
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const supabase = createClient();

  useEffect(() => {
    loadToday();
  }, []);

  async function loadToday() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("daily_motivations")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (data) {
      setExisting(data);
      setQuote(data.quote || "");
      setReflection(data.reflection || "");
      setGratitude(data.gratitude || "");
      setMood(data.mood || "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Not authenticated");
        return;
      }

      const today = format(new Date(), "yyyy-MM-dd");
      const data = {
        user_id: user.id,
        workspace_id: workspaceId,
        date: today,
        quote: quote.trim() || null,
        reflection: reflection.trim() || null,
        gratitude: gratitude.trim() || null,
        mood: mood.trim() || null,
      };

      if (existing) {
        const { error: updateError } = await supabase
          .from("daily_motivations")
          .update(data)
          .eq("id", existing.id);

        if (updateError) {
          setError(updateError.message);
          return;
        }
      } else {
        const { error: insertError } = await supabase.from("daily_motivations").insert(data);

        if (insertError) {
          setError(insertError.message);
          return;
        }
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Daily Motivation</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Set your intention for {format(new Date(), "MMMM d, yyyy")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Today&apos;s Reflection
          </CardTitle>
          <CardDescription>Start your day with positive thoughts and intentions</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="quote" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Inspirational Quote
              </label>
              <textarea
                id="quote"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Enter a quote that inspires you today..."
                rows={3}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="reflection" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Reflection
              </label>
              <textarea
                id="reflection"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="What are you thinking about today? What are your goals?"
                rows={4}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="gratitude" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Gratitude
              </label>
              <textarea
                id="gratitude"
                value={gratitude}
                onChange={(e) => setGratitude(e.target.value)}
                placeholder="What are you grateful for today?"
                rows={3}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="mood" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Mood
              </label>
              <input
                id="mood"
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="How are you feeling today?"
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                disabled={loading}
              />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : existing ? "Update" : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
