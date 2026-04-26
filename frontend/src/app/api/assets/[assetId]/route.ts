import { type NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { deleteAssetRecord } from "@/lib/backend";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params;
    await deleteAssetRecord(assetId);

    return NextResponse.json({ success: true, assetId });
  } catch (err) {
    const e = err as Error;
    // If not found, still return success or 404
    if (e.message.includes("not found") || e.message.includes("fetching asset")) {
       return NextResponse.json(
        { error: "Asset tidak ditemukan." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: e.message || "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
