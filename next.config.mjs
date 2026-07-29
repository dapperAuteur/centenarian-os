import path from 'path';
import { fileURLToPath } from 'url';
import { withSentryConfig } from '@sentry/nextjs';

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

// Wrap with Sentry's build plugin. Safe with no Sentry env set: without
// SENTRY_AUTH_TOKEN it simply skips the source-map upload (you just get
// minified stack traces), and the runtime SDK stays inert without a DSN.
// org/project/authToken all come from env so nothing secret is committed here.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
});