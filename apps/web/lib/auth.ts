import NextAuth from "next-auth";
import sql from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    {
      id: "strava",
      name: "Strava",
      type: "oauth",
      checks: ["state"],
      client: { token_endpoint_auth_method: "client_secret_post" },
      authorization: {
        url: "https://www.strava.com/oauth/authorize",
        params: {
          scope: "read,activity:read_all",
          response_type: "code",
          approval_prompt: "force",
        },
      },
      token: "https://www.strava.com/oauth/token",
      userinfo: "https://www.strava.com/api/v3/athlete",
      clientId: process.env.STRAVA_CLIENT_ID!,
      clientSecret: process.env.STRAVA_CLIENT_SECRET!,
      profile(profile: any) {
        return {
          id: String(profile.id),
          name: `${profile.firstname} ${profile.lastname}`,
          email: profile.email ?? `strava_${profile.id}@draftcoach.app`,
          image: profile.profile,
          stravaId: profile.id,
        };
      },
    },
  ],
  callbacks: {
    async signIn({ user, account }: any) {
      if (!account || account.provider !== "strava") return false;
      const expiresAt = new Date((account.expires_at ?? 0) * 1000).toISOString();
      try {
        await sql`
          INSERT INTO users (strava_id, name, email, profile_photo, access_token, refresh_token, token_expires_at, updated_at)
          VALUES (
            ${Number(user.stravaId ?? user.id)},
            ${user.name},
            ${user.email},
            ${user.image},
            ${account.access_token},
            ${account.refresh_token},
            ${expiresAt},
            NOW()
          )
          ON CONFLICT (strava_id) DO UPDATE SET
            name             = EXCLUDED.name,
            email            = EXCLUDED.email,
            profile_photo    = EXCLUDED.profile_photo,
            access_token     = EXCLUDED.access_token,
            refresh_token    = EXCLUDED.refresh_token,
            token_expires_at = EXCLUDED.token_expires_at,
            updated_at       = NOW()
        `;
      } catch (err: any) {
        console.error("[auth] DB upsert error:", err.message);
        return false;
      }
      return true;
    },
    async jwt({ token, account, user }: any) {
      if (account && user) {
        token.stravaId    = Number(user.stravaId ?? user.id);
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt   = account.expires_at;
      }
      return token;
    },
    async session({ session, token }: any) {
      session.user.stravaId = token.stravaId;
      session.accessToken   = token.accessToken;
      return session;
    },
  },
  pages: { signIn: "/", error: "/" },
  secret: process.env.NEXTAUTH_SECRET,
});
