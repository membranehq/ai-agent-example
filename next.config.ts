import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
  },
  images: {
    remotePatterns: [
      new URL('https://avatar.vercel.sh/**'),
      new URL('https://static.integration.app/**'),
      new URL('https://integration-app-assets.s3.eu-central-1.amazonaws.com/**'),
    ],
  },
};

export default nextConfig;
