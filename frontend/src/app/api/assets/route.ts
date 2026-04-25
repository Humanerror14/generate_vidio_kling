import { NextResponse } from "next/server";
import { readAssetRecords, sanitizeAssetRecord } from "@/lib/backend";

export async function GET() {
  try {
    const records = await readAssetRecords();
    const assets = records
      .slice()
      .sort(
        (a, b) =>
          new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      )
      .map(sanitizeAssetRecord);
    return NextResponse.json({ success: true, assets });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json(
      { error: e.message || "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
