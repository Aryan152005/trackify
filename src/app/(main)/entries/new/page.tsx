import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AddEntryForm } from "./add-entry-form";

export default async function NewEntryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tags } = await supabase.from("tags").select("id, name, color").order("name");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Add work entry
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Log what you did, learned, and plan next
        </p>
      </div>
      <AddEntryForm userId={user.id} tags={tags ?? []} />
    </div>
  );
}
