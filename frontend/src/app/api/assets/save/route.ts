import { type NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import {
  readAssetRecords,
  writeAssetRecord,
  sanitizeAssetRecord,
  formatPromptTitle,
  safeSlug,
  inferVideoExtension,
  downloadAndUploadVideo,
  modelRegistry,
  defaultModel,
  randomUUID,
} from "@/lib/backend";

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
    
    // We don't have the content type yet, so we'll infer extension later or use a generic one for the storage path
    // Actually, downloadAndUploadVideo needs a filename.
    const tempFileName = `${assetId}.mp4`;
    const uploadResult = await downloadAndUploadVideo(remoteVideoUrl, tempFileName);
    
    const extension = inferVideoExtension(
      uploadResult.contentType,
      remoteVideoUrl
    );
    const fileName = `${safeSlug(title)}-${assetId.slice(0, 8)}${extension}`;
    
    // If the extension was different, we might want to rename in storage, 
    // but for now let's just use the final fileName for the actual record.
    // Let's refine downloadAndUploadVideo to take the final name if possible, 
    // or just use the assetId based name.
    
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
      storagePath: uploadResult.storagePath,
      contentType: uploadResult.contentType,
      sizeBytes: uploadResult.sizeBytes,
    };

    await writeAssetRecord(assetRecord);

    // Fetch the record again to get the savedAt timestamp if needed, 
    // or just return the record with a mocked savedAt for immediate UI feedback.
    const finalRecord = { ...assetRecord, savedAt: new Date().toISOString() };

    return NextResponse.json(
      { success: true, asset: sanitizeAssetRecord(finalRecord) },
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
