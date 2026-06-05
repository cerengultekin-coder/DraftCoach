import { NextResponse } from "next/server";
import { auth } from "./auth";
import sql from "./db";

export type Lang = "tr" | "en";

/** Coerce arbitrary input to a supported locale, defaulting to Turkish. */
export const asLang = (value: unknown): Lang => (value === "en" ? "en" : "tr");

export type AuthedUser = { id: string; stravaId: number };

/**
 * Resolve the authenticated user's database id from the session.
 * Returns null when there is no valid session or no matching user row,
 * so callers can respond with a single `unauthorized()`.
 */
export async function getAuthedUser(): Promise<AuthedUser | null> {
  const session = await auth();
  const stravaId = session?.user?.stravaId;
  if (!stravaId) return null;

  const [row] = await sql`SELECT id FROM users WHERE strava_id = ${stravaId} LIMIT 1`;
  if (!row) return null;

  return { id: row.id as string, stravaId };
}

// ── Consistent JSON responses ────────────────────────────────────────────────
export const ok = (data: unknown) => NextResponse.json(data);
export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
export const notFound = (message = "Not found") => NextResponse.json({ error: message }, { status: 404 });
export const badRequest = (message = "Bad request") => NextResponse.json({ error: message }, { status: 400 });
export const serverError = (message = "Internal error") => NextResponse.json({ error: message }, { status: 500 });
