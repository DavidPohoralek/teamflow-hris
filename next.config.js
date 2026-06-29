/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'dotaznik.tmflw.com' }],
        destination: '/dotaznik/:path*',
      },
      {
        source: '/',
        has: [{ type: 'host', value: 'dotaznik.tmflw.com' }],
        destination: '/dotaznik',
      },
    ];
  },
};

module.exports = nextConfig;
