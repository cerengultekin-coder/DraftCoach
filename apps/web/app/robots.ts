import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://draft-coach-mu.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/tr", "/en"],
      // Auth-gated, user-specific pages — keep out of search indexes
      disallow: ["/api/", "/tr/dashboard", "/en/dashboard", "/tr/activity/", "/en/activity/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
