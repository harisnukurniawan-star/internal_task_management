import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ claimId: string }> },
) {
  const { supabase } = await requireProfile();
  const { claimId } = await params;

  const { data: evidence } = await supabase
    .from("evidence_files")
    .select("file_name,storage_path")
    .eq("claim_id", claimId)
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
