import { headers } from "next/headers";

function normalizeOrigin(value: string | undefined | null) {
  if (!value) return null;
  const candidate = value.includes("://") ? value : `https://${value}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export async function getAppOrigin() {
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;

  const productionUrl = normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (productionUrl) return productionUrl;

  const vercelUrl = normalizeOrigin(process.env.VERCEL_URL);
  if (vercelUrl) return vercelUrl;

  const requestHeaders = await headers();
  const requestOrigin = normalizeOrigin(requestHeaders.get("origin"));
  if (requestOrigin) return requestOrigin;

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const forwardedOrigin = host ? normalizeOrigin(`${proto}://${host}`) : null;
  if (forwardedOrigin) return forwardedOrigin;

  throw new Error("Application URL could not be resolved.");
}
