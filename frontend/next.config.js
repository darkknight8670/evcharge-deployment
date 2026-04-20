/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: "http://127.0.0.1:4000/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
