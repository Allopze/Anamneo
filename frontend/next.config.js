/** @type {import('next').NextConfig} */
const backendApiUrl = (process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4444/api').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
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
