import { type NextRequest, NextResponse } from "next/server";
import { readAssetRecords } from "@/lib/backend";
import * as fs from "node:fs/promises";

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

    // Try local /tmp first, fallback to remote URL redirect
    try {
      const fileBytes = await fs.readFile(record.filePath);
      return new NextResponse(fileBytes, {
        headers: {
          "Content-Type": record.contentType || "video/mp4",
          "Content-Disposition": `attachment; filename="${record.fileName}"`,
          "Content-Length": String(fileBytes.length),
        },
      });
    } catch {
      // File not in /tmp, redirect to remote so browser can download
      return NextResponse.redirect(record.remoteVideoUrl);
    }
  } catch (err) {
    const e = err as Error;
    return NextResponse.json(
      { error: e.message || "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
