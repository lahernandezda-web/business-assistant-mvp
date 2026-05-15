import { NextResponse } from "next/server";
import { getSupabaseServerStatus } from "@/lib/supabase/status";

export async function GET() {
  return NextResponse.json(getSupabaseServerStatus());
}
