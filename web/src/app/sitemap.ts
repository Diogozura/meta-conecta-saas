import type { MetadataRoute } from "next";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://dybot.com.br");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${appUrl}/politica-de-privacidade`,
      lastModified: new Date("2026-05-19"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
