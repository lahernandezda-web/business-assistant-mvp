import { NextResponse } from "next/server";

import { createContact, getRecentContacts } from "@/lib/contacts/persistence";
import { contactsErrorMessages } from "@/lib/contacts/types";
import { validateCreateContactBody } from "@/lib/contacts/validate-input";

export async function GET() {
  const result = await getRecentContacts();

  if (!result.ok) {
    return NextResponse.json(
      { error: contactsErrorMessages.failedToLoadContacts },
      { status: 500 },
    );
  }

  return NextResponse.json({ contacts: result.data });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: contactsErrorMessages.invalidJsonBody },
      { status: 400 },
    );
  }

  const validation = validateCreateContactBody(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const result = await createContact(validation.input);

  if (!result.ok) {
    return NextResponse.json(
      { error: contactsErrorMessages.failedToCreateContact },
      { status: 500 },
    );
  }

  return NextResponse.json({ contact: result.data });
}
