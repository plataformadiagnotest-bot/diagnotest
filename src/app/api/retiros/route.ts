import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const personalId = searchParams.get("personal_id");
  const fecha = searchParams.get("fecha");

  let query = supabase
    .from("retiros")
    .select("*, personal:personal_id(nombre), veterinaria:veterinaria_id(nombre, codigo)")
    .eq("anulado", false)
    .order("timestamp_carga", { ascending: false })
    .limit(200);

  if (personalId) query = query.eq("personal_id", personalId);
  if (fecha) query = query.eq("fecha_operativa", fecha);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("retiros")
    .insert({ ...body, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
