import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Cacheia o build do Turbopack em .next/cache entre deploys.
    // O Vercel restaura essa pasta automaticamente, então builds
    // subsequentes (sem mudar dependências) tendem a ficar bem mais rápidos.
    turbopackFileSystemCacheForBuild: true,
  },
};

export default nextConfig;
