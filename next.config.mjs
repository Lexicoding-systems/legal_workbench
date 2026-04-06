/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse and pg use native Node modules; exclude from client bundle
  serverExternalPackages: ["pdf-parse", "pg"],
};

export default nextConfig;
