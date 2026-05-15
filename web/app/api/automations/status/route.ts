import { NextResponse } from "next/server";
import { getAutomationServerStatus } from "@/lib/automations/client";

export async function GET() {
  return NextResponse.json(getAutomationServerStatus());
}
