import { type NextRequest, NextResponse } from "next/server";
import {
  readAssetRecords,
  writeAssetRecords,
} from "@/lib/backend";
import * as fs from "node:fs/promises";

export async function DELETE(
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

    try {
      await fs.rm(record.filePath, { force: true });
    } catch {
      // Ignore missing local file
    }

    const nextRecords = records.filter((item) => item.id !== assetId);
    await writeAssetRecords(nextRecords);

    return NextResponse.json({ success: true, assetId });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json(
      { error: e.message || "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
