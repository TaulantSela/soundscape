/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    // The native app's sign-in passes through the login and consent pages;
    // no other site may frame them to trick a click on "Allow".
    return [{ source: '/auth/:path*', headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }] }];
  }
  // NEXT_PUBLIC_* variables are inlined automatically. Do not add defaults
  // here: a hard-coded fallback ends up baked into production builds.
};

export default nextConfig;
