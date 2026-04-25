import { type NextRequest, NextResponse } from "next/server";
import {
  readAssetRecords,
  writeAssetRecords,
  sanitizeAssetRecord,
  formatPromptTitle,
  safeSlug,
  inferVideoExtension,
  downloadRemoteVideo,
  modelRegistry,
  defaultModel,
  randomUUID,
  assetVideoDir,
} from "@/lib/backend";
import * as path from "node:path";
import * as fs from "node:fs/promises";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      taskId,
      prompt,
      model,
      videoUrl,
      aspectRatio,
      duration,
      sourceKind,
      sourceImageUrl,
    } = body || {};

    if (typeof videoUrl !== "string" || videoUrl.trim().length === 0) {
      return NextResponse.json(
        { error: "Video URL wajib tersedia sebelum asset bisa disimpan." },
        { status: 400 }
      );
    }

    const records = await readAssetRecords();
    const existing = records.find(
      (item) =>
        (taskId && item.taskId === taskId) ||
        item.remoteVideoUrl === videoUrl.trim()
    );

    if (existing) {
      return NextResponse.json({
        success: true,
        deduplicated: true,
        asset: sanitizeAssetRecord(existing),
      });
    }

    const normalizedModel =
      typeof model === "string" && modelRegistry[model] ? model : defaultModel;
    const title = formatPromptTitle(prompt);
    const assetId = randomUUID();
    const remoteVideoUrl = videoUrl.trim();
    const tempPath = path.join(assetVideoDir, `${assetId}.download`);
    const downloadResult = await downloadRemoteVideo(remoteVideoUrl, tempPath);
    const extension = inferVideoExtension(
      downloadResult.contentType,
      remoteVideoUrl
    );
    const fileName = `${safeSlug(title)}-${assetId.slice(0, 8)}${extension}`;
    const filePath = path.join(assetVideoDir, fileName);
    await fs.rename(tempPath, filePath);
    const savedAt = new Date().toISOString();

    const assetRecord = {
      id: assetId,
      title,
      prompt: typeof prompt === "string" ? prompt : "",
      taskId: typeof taskId === "string" && taskId ? taskId : assetId,
      model: normalizedModel,
      aspectRatio: typeof aspectRatio === "string" ? aspectRatio : "16:9",
      duration: typeof duration === "string" ? duration : "5",
      sourceKind:
        typeof sourceKind === "string" && sourceKind ? sourceKind : "Prompt only",
      sourceImageUrl:
        typeof sourceImageUrl === "string" && sourceImageUrl ? sourceImageUrl : "",
      remoteVideoUrl,
      fileName,
      filePath,
      contentType: downloadResult.contentType,
      sizeBytes: downloadResult.sizeBytes,
      savedAt,
    };

    const nextRecords = [assetRecord, ...records];
    await writeAssetRecords(nextRecords);

    return NextResponse.json(
      { success: true, asset: sanitizeAssetRecord(assetRecord) },
      { status: 201 }
    );
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return NextResponse.json(
      { error: e.message || "Terjadi kesalahan pada server." },
      { status: e.statusCode || 500 }
    );
  }
}
