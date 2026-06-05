import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://draft-coach-mu.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  // Only the public landing pages are indexable; dashboards are auth-gated.
  return [
    {
      url: `${SITE_URL}/tr`,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
      alternates: { languages: { tr: `${SITE_URL}/tr`, en: `${SITE_URL}/en` } },
    },
    {
      url: `${SITE_URL}/en`,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
      alternates: { languages: { tr: `${SITE_URL}/tr`, en: `${SITE_URL}/en` } },
    },
  ];
}
