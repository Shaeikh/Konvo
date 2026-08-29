import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import db from "@/lib/db";

type Params = Promise<{ room: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { room } = await params;

  const searchParams = request.nextUrl.searchParams;
  const before = searchParams.get("before");

  try {
    const query = `
    SELECT
      m.id AS message_id,
      m.room,
      m.type,
      m.content,
      m.created_at AS message_created_at,
      u.id AS user_id,
      u.name,
      u.email,
      u.image,
      u."createdAt" AS user_created_at,
      u."updatedAt" AS user_updated_at
    FROM messages m
    LEFT JOIN "user" u
      ON m.user_id = u.id
    WHERE m.room = $1
      AND m.type != 'system'
      ${before ? "AND m.id < $2" : ""}
    ORDER BY m.id DESC
    LIMIT 20
  `;

    const values = before ? [room, before] : [room];

    type MessageRow = {
      message_id: string;
      room: string;
      type: "normal" | "system";
      content: string;
      message_created_at: string;
      user_id: string | null;
      name: string | null;
      email: string | null;
      image: string | null;
      user_created_at: Date | null;
      user_updated_at: Date | null;
    };

    const { rows } = await db.query<MessageRow>(query, values);

    // Reverse so the oldest message is first, matching your
    // original SQLite query.
    rows.reverse();

    const messages = rows.map((row) => ({
      id: row.message_id,
      room: row.room,
      type: row.type,
      content: row.content,
      createdAt: Number(row.message_created_at),

      user: {
        id: row.user_id,
        name: row.name,
        email: row.email,
        image: row.image,
        createdAt: row.user_created_at ? new Date(row.user_created_at) : null,
        updatedAt: row.user_updated_at ? new Date(row.user_updated_at) : null,
      },
    }));

    return NextResponse.json(messages);
  } catch (e: unknown) {
    console.error(e);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
