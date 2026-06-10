import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SyncQueueItem } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const item: SyncQueueItem = await request.json();
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase.from(item.table as any);

    switch (item.action) {
      case "create": {
        // Al llegar al servidor el registro ya está sincronizado.
        const data = item.table === "retiros"
          ? { ...(item.data as Record<string, unknown>), sincronizado: true }
          : item.data;
        const { error } = await db.insert(data);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        break;
      }
      case "update": {
        const { id, ...rest } = item.data as { id: string; [key: string]: unknown };
        const { error } = await db.update(rest).eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        break;
      }
      case "delete": {
        const { id } = item.data as { id: string };
        const { error } = await db.update({ anulado: true }).eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
