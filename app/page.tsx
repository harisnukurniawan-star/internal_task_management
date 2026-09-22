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

  if (params.code) {
    const query = new URLSearchParams({
      code: params.code,
      next: "/set-password",
    });
    redirect(`/auth/confirm?${query.toString()}`);
  }

  if (params.token_hash && params.type) {
    const query = new URLSearchParams({
      token_hash: params.token_hash,
      type: params.type,
      next: "/set-password",
    });
    redirect(`/auth/confirm?${query.toString()}`);
  }

  redirect("/dashboard");
}
