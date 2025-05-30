import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
  },
  images: {
    remotePatterns: [
      new URL('https://avatar.vercel.sh/**'),
      new URL('https://static.integration.app/connectors/**'),
    ],
  },
};

export default nextConfig;
