import type { MetadataRoute } from "next";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://dybot.com.br");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/politica-de-privacidade"],
        disallow: ["/dashboard/", "/api/", "/login"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
