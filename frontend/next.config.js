const path = require('path');
const { loadEnvConfig } = require('@next/env');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
const { withSentryConfig } = require('@sentry/nextjs');

loadEnvConfig(path.join(__dirname, '..'));

/** @type {import('next').NextConfig} */
const backendApiUrl = (process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5679/api').replace(/\/$/, '');
const defaultAllowedDevOrigins = [
  'localhost',
  '127.0.0.1',
  '192.168.*.*',
  '10.*.*.*',
  'anamneo.lat',
  '*.anamneo.lat',
  'anamneo.cloudbox.lat',
  '*.cloudbox.lat',
];
const configuredAllowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedDevOrigins = Array.from(new Set([
  ...defaultAllowedDevOrigins,
  ...configuredAllowedDevOrigins,
]));

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: path.join(__dirname, '..'),
  },
  outputFileTracingRoot: path.join(__dirname, '..'),
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

module.exports = withBundleAnalyzer(withSentryConfig(nextConfig, {
  silent: true,
  disableServerWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,
  disableClientWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,
}))
