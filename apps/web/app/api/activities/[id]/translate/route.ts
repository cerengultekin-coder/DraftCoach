import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import sql from "@/lib/db";
import { translateCards } from "@/lib/groq";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const stravaId = (session?.user as any)?.stravaId;
  if (!stravaId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lang, analysis_id } = await req.json().catch(() => ({}));
  if (!lang) return NextResponse.json({ error: "lang required" }, { status: 400 });

  const [userRow] = await sql`SELECT id FROM users WHERE strava_id = ${stravaId} LIMIT 1`;
  if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [source] = await sql`
    SELECT an.id, an.cards, an.ai_model
    FROM analyses an
    JOIN activities a ON a.id = an.activity_id
    WHERE an.id = ${analysis_id} AND a.id = ${id} AND a.user_id = ${userRow.id}
    LIMIT 1
  `;
  if (!source) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });

  const cards = await translateCards(source.cards, lang);

  const [saved] = await sql`
    INSERT INTO analyses (activity_id, user_id, cards, ai_model, lang)
    VALUES (${id}, ${userRow.id}, ${JSON.stringify(cards)}, ${source.ai_model}, ${lang})
    RETURNING id, cards, ai_model, lang, created_at
  `;

  return NextResponse.json({ id: saved.id, cards, ai_model: saved.ai_model, lang: saved.lang });
}
