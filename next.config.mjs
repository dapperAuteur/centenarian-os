import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

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