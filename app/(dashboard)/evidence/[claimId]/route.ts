import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ claimId: string }> },
) {
  const { supabase } = await requireProfile();
  const { claimId } = await params;
  const evidenceId = new URL(request.url).searchParams.get("file");

  let query = supabase
    .from("evidence_files")
    .select("id,file_name,storage_path")
    .eq("claim_id", claimId);

  if (evidenceId) {
    query = query.eq("id", evidenceId);
  }

  const { data: evidence } = await query
    .limit(1)
    .maybeSingle();

  if (!evidence) {
    return new NextResponse("Evidence tidak ditemukan.", { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("task-evidence")
    .createSignedUrl(evidence.storage_path, 120, { download: evidence.file_name });

  if (error || !data?.signedUrl) {
    return new NextResponse("Evidence tidak dapat dibuka.", { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
