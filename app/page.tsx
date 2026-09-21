import { redirect } from "next/navigation";

type RootSearchParams = {
  code?: string;
  token_hash?: string;
  type?: string;
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<RootSearchParams>;
}) {
  const params = await searchParams;

  // Recovery fallback: some Supabase email configurations may redirect
  // to the Site URL root with the PKCE code instead of the requested path.
  // Preserve that credential and continue through the canonical confirm route
  // rather than dropping it when the home page redirects to the dashboard.
  if (params.code) {
    const query = new URLSearchParams({
      code: params.code,
      next: "/reset-password",
    });
    redirect(`/auth/confirm?${query.toString()}`);
  }

  // Also support token-hash based recovery templates.
  if (params.token_hash && params.type) {
    const query = new URLSearchParams({
      token_hash: params.token_hash,
      type: params.type,
      next: "/reset-password",
    });
    redirect(`/auth/confirm?${query.toString()}`);
  }

  redirect("/dashboard");
}
