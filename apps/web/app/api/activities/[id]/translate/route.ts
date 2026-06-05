import sql from "@/lib/db";
import { translateCards } from "@/lib/groq";
import { getAuthedUser, asLang, ok, unauthorized, notFound, badRequest, serverError } from "@/lib/api";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const lang = asLang(body.lang);
  const analysisId = body.analysis_id;
  if (!analysisId) return badRequest("analysis_id required");

  // Verify ownership and fetch the source analysis in one query
  const [source] = await sql`
    SELECT an.id, an.cards, an.ai_model
    FROM analyses an
    JOIN activities a ON a.id = an.activity_id
    WHERE an.id = ${analysisId} AND a.id = ${id} AND a.user_id = ${user.id}
    LIMIT 1
  `;
  if (!source) return notFound("Analysis not found");

  let cards;
  try {
    cards = await translateCards(source.cards, lang);
  } catch (err) {
    console.error("[translate] Groq error:", err);
    return serverError("Translation failed");
  }

  const [saved] = await sql`
    INSERT INTO analyses (activity_id, user_id, cards, ai_model, lang)
    VALUES (${id}, ${user.id}, ${JSON.stringify(cards)}, ${source.ai_model}, ${lang})
    RETURNING id, cards, ai_model, lang, created_at
  `;

  return ok({ id: saved.id, cards, ai_model: saved.ai_model, lang: saved.lang });
}
