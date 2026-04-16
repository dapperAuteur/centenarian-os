import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Expose CLOUDINARY_API_KEY to the client as NEXT_PUBLIC_CLOUDINARY_API_KEY
  // so next-cloudinary's CldUploadWidget can find it. The API key is NOT a
  // secret — it's a public identifier (like a username). Only the API_SECRET
  // is private. This alias means you set one env var (CLOUDINARY_API_KEY) and
  // both server routes and client components see it.
  env: {
    NEXT_PUBLIC_CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '**.ytimg.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/blog/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.instagram.com https://platform.twitter.com https://www.tiktok.com",
              "img-src 'self' data: https://res.cloudinary.com https://*.ytimg.com https://*.twimg.com",
              "script-src 'self' 'unsafe-inline' https://platform.twitter.com https://www.instagram.com",
            ].join('; '),
          },
        ],
      },
    ];
  },

  async rewrites() {
    const umamiHost = process.env.UMAMI_HOST_URL;
    if (!umamiHost) return [];
    return [
      { source: '/a/script.js', destination: `${umamiHost}/script.js` },
      { source: '/a/api/send', destination: `${umamiHost}/api/send` },
    ];
  },

  webpack: (config, { isServer }) => {
    // Add path alias
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': __dirname,
    };

    config.externals = [...(config.externals || []), 'supabase'];
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;