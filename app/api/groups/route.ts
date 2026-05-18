import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SUMMER_2026_WEEKENDS } from "@/lib/weekends";

export async function POST(req: NextRequest) {
  const { name, email } = await req.json();

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  // Create the group
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({ name: name.trim(), creator_email: email.trim(), season_type: "summer_2026", range_start: null, range_end: null })
    .select()
    .single();

  if (groupError || !group) {
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }

  // Seed the 16 summer weekends
  const weekendRows = SUMMER_2026_WEEKENDS.map((w) => ({
    ...w,
    group_id: group.id,
  }));

  const { error: weekendError } = await supabase.from("weekends").insert(weekendRows);

  if (weekendError) {
    return NextResponse.json({ error: "Failed to seed weekends" }, { status: 500 });
  }

  return NextResponse.json({ group });
}
