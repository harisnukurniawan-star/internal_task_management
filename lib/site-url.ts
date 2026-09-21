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

function isLocalOrigin(origin: string | null) {
  if (!origin) return false;
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function isProductionRuntime() {
  if (process.env.VERCEL) {
    return process.env.VERCEL_ENV === "production";
  }
  return process.env.NODE_ENV === "production";
}

function usableOrigin(origin: string | null, production: boolean) {
  if (!origin) return null;
  if (production && isLocalOrigin(origin)) return null;
  return origin;
}

export async function getAppOrigin() {
  const production = isProductionRuntime();

  const configured = usableOrigin(normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL), production);
  if (configured) return configured;

  const productionUrl = usableOrigin(normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL), production);
  if (productionUrl) return productionUrl;

  const vercelUrl = usableOrigin(normalizeOrigin(process.env.VERCEL_URL), production);
  if (vercelUrl) return vercelUrl;

  const requestHeaders = await headers();
  const requestOrigin = usableOrigin(normalizeOrigin(requestHeaders.get("origin")), production);
  if (requestOrigin) return requestOrigin;

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const forwardedOrigin = usableOrigin(host ? normalizeOrigin(`${proto}://${host}`) : null, production);
  if (forwardedOrigin) return forwardedOrigin;

  throw new Error("Application URL could not be resolved safely.");
}
