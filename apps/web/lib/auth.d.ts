import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    stravaId?: number;
  }
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      stravaId?: number;
    };
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