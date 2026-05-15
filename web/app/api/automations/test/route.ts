import { NextResponse } from "next/server";
import { sendAutomationEvent } from "@/lib/automations/client";
import { createAutomationEvent } from "@/lib/automations/events";
import type { AutomationSendError } from "@/lib/automations/types";

const TEST_EVENT = "test.automation" as const;

type TestAutomationOkResponse = {
  event: typeof TEST_EVENT;
  sent: true;
  status: number;
};

type TestAutomationErrResponse = {
  event: typeof TEST_EVENT;
  sent: false;
  error: AutomationSendError;
  status?: number;
};

export async function POST() {
  const payload = createAutomationEvent({
    event: TEST_EVENT,
    data: {
      message: "Automation test event",
      manual: true,
    },
  });

  const result = await sendAutomationEvent(payload);

  if (result.ok) {
    const body: TestAutomationOkResponse = {
      event: TEST_EVENT,
      sent: true,
      status: result.status,
    };
    return NextResponse.json(body);
  }

  const body: TestAutomationErrResponse = {
    event: TEST_EVENT,
    sent: false,
    error: result.error,
  };
  if (result.status !== undefined) {
    body.status = result.status;
  }
  return NextResponse.json(body);
}
