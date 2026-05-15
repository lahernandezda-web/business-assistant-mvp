import { NextResponse } from "next/server";
import { getAIServerStatus } from "@/lib/ai/status";

export async function GET() {
  return NextResponse.json(getAIServerStatus());
}
