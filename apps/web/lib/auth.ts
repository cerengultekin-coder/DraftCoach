import NextAuth from "next-auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "strava",
      name: "Strava",
      type: "oauth",
      authorization: {
        url: "https://www.strava.com/oauth/authorize",
        params: {
          scope: "read,activity:read_all",
          response_type: "code",
          approval_prompt: "auto",
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
      const { error } = await supabase.from("users").upsert(
        {
          strava_id: Number(user.stravaId ?? user.id),
          name: user.name,
          email: user.email,
          profile_photo: user.image,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "strava_id" }
      );
      if (error) {
        console.error("[auth] Supabase upsert error:", error.message);
        return false;
      }
      return true;
    },
    async jwt({ token, account, user }: any) {
      if (account && user) {
        token.stravaId = Number(user.stravaId ?? user.id);
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }: any) {
      session.user.stravaId = token.stravaId;
      session.accessToken = token.accessToken;
      return session;
    },
  },
  pages: { signIn: "/", error: "/" },
  secret: process.env.NEXTAUTH_SECRET,
});