import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Last-chance update persist endpoint.
 *
 * The in-browser Yjs provider appends every local update to the DB via a
 * server action 300 ms after it happens. But if the user closes the tab
 * inside that window, the server action never fires (React doesn't get a
 * chance to run cleanup). `beforeunload` can't await async work, but it
 * CAN fire a `fetch(..., { keepalive: true })` or `navigator.sendBeacon`
 * — both of which post to this route.
 *
 * The payload is the still-pending merged update, base64-encoded. We
 * rely on RLS from migration 039 to enforce that the caller is actually
 * allowed to write to this entity — anything sneaky and the insert is
 * rejected with 403-like behaviour.
 */
export async function POST(request: NextRequest) {
  let body: {
    entity?: string;
    entityId?: string;
    updateB64?: string;
    clientId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const { entity, entityId, updateB64, clientId } = body;
  if (!entity || !entityId || !updateB64 || !clientId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (entity !== "drawings" && entity !== "mindmaps" && entity !== "pages") {
    return NextResponse.json({ error: "Bad entity" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bytes = Buffer.from(updateB64, "base64");
  const hex = "\\x" + bytes.toString("hex");
  const { error } = await supabase.from("yjs_updates").insert({
    entity,
    entity_id: entityId,
    update_bytes: hex,
    client_id: clientId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
