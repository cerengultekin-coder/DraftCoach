import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    stravaId?: number;
  }
  interface Session {
    user: {
      stravaId?: number;
    } & DefaultSession["user"];
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    stravaId?: number;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}
