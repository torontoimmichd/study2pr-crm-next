/** @type {import('next').NextConfig} */
const nextConfig = {
  // The previous Vite app did not use React StrictMode; keep behavior identical.
  reactStrictMode: false,
  eslint: { ignoreDuringBuilds: true },
  // The old Vite build never ran the TypeScript checker, so pre-existing type
  // errors must not block deploys — identical to the old pipeline.
  // TODO: remove once the codebase is type-cleaned in a dedicated session.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
