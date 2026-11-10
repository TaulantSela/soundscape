/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true
  // NEXT_PUBLIC_* variables are inlined automatically. Do not add defaults
  // here: a hard-coded fallback ends up baked into production builds.
};

export default nextConfig;
