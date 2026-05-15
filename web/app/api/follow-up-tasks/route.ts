import { NextResponse } from "next/server";

import {
  createFollowUpTask,
  getRecentFollowUpTasks,
} from "@/lib/follow-up-tasks/persistence";
import { followUpTasksErrorMessages } from "@/lib/follow-up-tasks/types";
import { validateCreateFollowUpTaskBody } from "@/lib/follow-up-tasks/validate-input";

export async function GET() {
  const result = await getRecentFollowUpTasks();

  if (!result.ok) {
    return NextResponse.json(
      { error: followUpTasksErrorMessages.failedToLoadTasks },
      { status: 500 },
    );
  }

  return NextResponse.json({ tasks: result.data });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: followUpTasksErrorMessages.invalidJsonBody },
      { status: 400 },
    );
  }

  const validation = validateCreateFollowUpTaskBody(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const result = await createFollowUpTask(validation.input);

  if (!result.ok) {
    return NextResponse.json(
      { error: followUpTasksErrorMessages.failedToCreateTask },
      { status: 500 },
    );
  }

  return NextResponse.json({ task: result.data });
}
