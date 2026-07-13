/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'tmflw.com' }],
        destination: 'https://www.tmflw.com/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        // Service worker must never be cached so updates are picked up immediately.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      {
        // HTML pages must never be cached in the PWA — after a deploy,
        // stale HTML references old JS chunk hashes that no longer exist,
        // causing React hydration to silently fail (buttons become dead).
        source: '/((?!_next/static|_next/image|favicon\\.svg|.*\\.png|.*\\.jpg|.*\\.pdf|.*\\.webp).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ]
  },
};

module.exports = nextConfig;
