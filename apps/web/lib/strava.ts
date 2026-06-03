import sql from "./db";

type UserToken = {
  id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
};

export async function getValidToken(user: UserToken): Promise<string> {
  const expiresAt = new Date(user.token_expires_at).getTime();
  if (expiresAt > Date.now() + 60_000) return user.access_token;

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type:    "refresh_token",
      refresh_token: user.refresh_token,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  await sql`
    UPDATE users SET
      access_token     = ${data.access_token},
      refresh_token    = ${data.refresh_token},
      token_expires_at = ${new Date(data.expires_at * 1000).toISOString()},
      updated_at       = NOW()
    WHERE id = ${user.id}
  `;

  return data.access_token;
}

