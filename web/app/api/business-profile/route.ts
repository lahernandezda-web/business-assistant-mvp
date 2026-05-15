import { NextResponse } from "next/server";

import {
  createBusinessProfile,
  getLatestBusinessProfile,
} from "@/lib/business-profile/persistence";
import { businessProfileErrorMessages } from "@/lib/business-profile/types";
import { validateCreateBusinessProfileBody } from "@/lib/business-profile/validate-input";

export async function GET() {
  const result = await getLatestBusinessProfile();

  if (!result.ok) {
    return NextResponse.json(
      { error: businessProfileErrorMessages.failedToLoadProfile },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile: result.data });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: businessProfileErrorMessages.invalidJsonBody },
      { status: 400 },
    );
  }

  const validation = validateCreateBusinessProfileBody(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const result = await createBusinessProfile(validation.input);

  if (!result.ok) {
    return NextResponse.json(
      { error: businessProfileErrorMessages.failedToCreateProfile },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile: result.data });
}
