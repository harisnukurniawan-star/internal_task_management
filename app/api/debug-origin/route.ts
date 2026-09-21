import { NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function GET() {
  let resolvedOrigin: string | null = null;
  let resolveError: string | null = null;

  try {
    resolvedOrigin = await getAppOrigin();
  } catch (error) {
    resolveError = error instanceof Error ? error.message : "unknown error";
  }

  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV ?? null,
    configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    projectProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    resolvedOrigin,
    resolveError,
  });
}
