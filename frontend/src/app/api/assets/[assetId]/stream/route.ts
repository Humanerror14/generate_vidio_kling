import { type NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { readAssetRecords, sanitizeAssetRecord } from "@/lib/backend";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params;
    const records = await readAssetRecords();
    const record = records.find((item) => item.id === assetId);

    if (!record) {
      return NextResponse.json(
        { error: "Asset tidak ditemukan." },
        { status: 404 }
      );
    }

    const { streamUrl } = sanitizeAssetRecord(record);
    return NextResponse.redirect(streamUrl);
  } catch (err) {
    const e = err as Error;
    return NextResponse.json(
      { error: e.message || "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
