import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AddEntryForm } from "./add-entry-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewEntryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tags } = await supabase.from("tags").select("id, name, color").order("name");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Add work entry"
        description="Log what you did, learned, and plan next"
        backHref="/entries"
        backLabel="Back to Entries"
      />
      <AddEntryForm userId={user.id} tags={tags ?? []} />
    </div>
  );
}
