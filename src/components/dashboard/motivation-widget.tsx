"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface MotivationWidgetProps {
  motivation: {
    quote?: string | null;
    reflection?: string | null;
    gratitude?: string | null;
    mood?: string | null;
  } | null;
}

export function MotivationWidget({ motivation }: MotivationWidgetProps) {
  if (!motivation || (!motivation.quote && !motivation.reflection && !motivation.gratitude)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Daily Motivation
          </CardTitle>
          <CardDescription>Start your day with intention</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Add a quote, reflection, or gratitude to set a positive tone for your day.
          </p>
          <Link href="/motivation">
            <Button variant="outline" className="w-full">
              Add Motivation
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Today&apos;s Motivation
        </CardTitle>
      </CardHeader>
      <CardContent>
        {motivation.quote && (
          <blockquote className="mb-4 border-l-4 border-indigo-500 pl-4 italic text-zinc-700 dark:text-zinc-300">
            &ldquo;{motivation.quote}&rdquo;
          </blockquote>
        )}
        {motivation.reflection && (
          <div className="mb-3">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Reflection:</p>
            <p className="text-sm text-zinc-900 dark:text-zinc-100">{motivation.reflection}</p>
          </div>
        )}
        {motivation.gratitude && (
          <div>
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Gratitude:</p>
            <p className="text-sm text-zinc-900 dark:text-zinc-100">{motivation.gratitude}</p>
          </div>
        )}
        <Link href="/motivation" className="mt-4 block">
          <Button variant="ghost" className="w-full text-xs">
            Edit →
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
