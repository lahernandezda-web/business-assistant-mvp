import { NextResponse } from "next/server";

import { getRecentConversations } from "@/lib/chat/persistence";



/**

 * Parsea `limit` de query. Valores no enteros o no finitos se tratan como ausentes

 * (la capa de persistencia aplicará el default 20).

 */

function parseLimitSearchParam(value: string | null): number | undefined {

  if (value === null || value.trim() === "") {

    return undefined;

  }

  const n = Number(value);

  if (!Number.isFinite(n) || !Number.isInteger(n)) {

    return undefined;

  }

  return n;

}



export async function GET(request: Request) {

  const { searchParams } = new URL(request.url);

  const limit = parseLimitSearchParam(searchParams.get("limit"));



  const result = await getRecentConversations(

    limit !== undefined ? { limit } : {},

  );



  if (!result.ok) {

    return NextResponse.json(

      { error: "failed to load conversations" },

      { status: 500 },

    );

  }



  return NextResponse.json({ conversations: result.data });

}


