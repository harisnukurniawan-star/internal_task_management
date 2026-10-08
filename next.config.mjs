/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Allow multipart overhead while evidence itself remains limited to 3 MB.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
