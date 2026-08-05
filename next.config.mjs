import path from 'path';
import { fileURLToPath } from 'url';
import { withSentryConfig } from '@sentry/nextjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // BUILD MEMORY. Vercel builds this app on a 2-core / 8 GB container, and it was
  // being OOM-killed (SIGKILL) during "Linting and checking validity of types".
  //
  // Next decides whether to run each webpack compilation in its own child process
  // with: `webpackBuildWorker || (webpackBuildWorker === undefined && !config.webpack)`.
  // This file defines a `webpack` function below, so the default resolved to FALSE
  // and the client, server, and edge compilations all piled up in one process --
  // which then also ran eslint and tsc on top of that. Setting this explicitly puts
  // each compilation back in a worker that exits and returns its memory.
  experimental: {
    webpackBuildWorker: true,
    // Trades a little compile time for a lower webpack heap ceiling.
    webpackMemoryOptimizations: true,
  },

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
        // NOTE for error monitoring: this policy sets no `connect-src` and no `default-src`, so
        // outbound fetch/XHR is unrestricted and the Sentry browser transport is NOT blocked here.
        // If a `connect-src` (or a `default-src`) is ever added, the DSN's ORIGIN must be listed in
        // it, otherwise every browser-side error report is silently dropped by the browser and the
        // dashboard just looks quiet. Add the origin only, never the DSN key.
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

// Without an auth token the plugin logs "Will not upload source maps" -- but it
// still GENERATES them first, across all three runtimes, and then throws them
// away. That is pure build-memory and build-time cost for an artifact nobody
// receives, and it was part of what pushed the Vercel build over its 8 GB
// ceiling. So the source-map machinery follows the token: off until BAM sets
// SENTRY_AUTH_TOKEN, fully on the moment it exists.
const hasSentryAuthToken = Boolean(process.env.SENTRY_AUTH_TOKEN);

// Wrap with Sentry's build plugin. Safe with no Sentry env set: without
// SENTRY_AUTH_TOKEN it simply skips the source-map upload (you just get
// minified stack traces), and the runtime SDK stays inert without a DSN.
// org/project/authToken all come from env so nothing secret is committed here.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  sourcemaps: { disable: !hasSentryAuthToken },
  // Uploading a wider net of client files is only useful when we are uploading
  // at all, and it is the expensive half of the source-map work.
  widenClientFileUpload: hasSentryAuthToken,
  webpack: {
    // Strips the SDK's own debug logging from the bundle. Replaces the deprecated top-level
    // `disableLogger` option. Webpack-only, so it is a no-op under Turbopack (same as the old
    // flag was), but it silences the v10 deprecation warning.
    treeshake: { removeDebugLogging: true },
  },
});