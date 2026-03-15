/** @type {import('next').NextConfig} */
const backendApiUrl = (process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4444/api').replace(/\/$/, '');
const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || 'localhost,127.0.0.1,192.168.*.*,10.*.*.*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins,
  env: {
    // Frontend always talks to same-origin /api to keep auth cookies on the app host.
    NEXT_PUBLIC_API_URL: '/api',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendApiUrl}/:path*`,
      },
    ];
  },
}

module.exports = nextConfig
