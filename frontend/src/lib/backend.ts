import { randomUUID } from "crypto";
export { randomUUID };
import * as path from "path";
import { supabaseAdmin } from "./supabase";

export const freepikBaseUrl =
  process.env.FREEPIK_API_BASE_URL || "https://api.freepik.com";
export const defaultModel =
  process.env.FREEPIK_VIDEO_MODEL || "kling-v3-std";

export const modelRegistry: Record<
  string,
  {
    label: string;
    submitPath: string;
    taskBasePath: string;
    startImageField: string;
    mode: string;
  }
> = {
  "kling-v3-std": {
    label: "Kling 3 Standard",
    submitPath: "/v1/ai/video/kling-v3-std",
    taskBasePath: "/v1/ai/video/kling-v3",
    startImageField: "start_image_url",
    mode: "kling",
  },
  "kling-v3-pro": {
    label: "Kling 3 Pro",
    submitPath: "/v1/ai/video/kling-v3-pro",
    taskBasePath: "/v1/ai/video/kling-v3",
    startImageField: "start_image_url",
    mode: "kling",
  },
  "kling-v3-omni-std": {
    label: "Kling 3 Omni Standard",
    submitPath: "/v1/ai/video/kling-v3-omni-std",
    taskBasePath: "/v1/ai/video/kling-v3-omni",
    startImageField: "image_url",
    mode: "kling",
  },
  "runway-4-5-i2v": {
    label: "Runway 4.5 Image",
    submitPath: "/v1/ai/image-to-video/runway-4-5",
    taskBasePath: "/v1/ai/image-to-video/runway-4-5",
    startImageField: "image",
    mode: "runway-image",
  },
  "kling-v3-motion-pro": {
    label: "Kling 3 Motion Control Pro",
    submitPath: "/v1/ai/video/kling-v3-motion-control-pro",
    taskBasePath: "/v1/ai/video/kling-v3-motion-control-pro",
    startImageField: "image_url",
    mode: "kling-motion",
  },
};

export function getModelConfig(modelId: string) {
  return (
    modelRegistry[modelId] ||
    modelRegistry[defaultModel] ||
    modelRegistry["kling-v3-std"]
  );
}

export function normalizeFreepikError(
  payload: unknown,
  fallback: string
): string {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  const p = payload as Record<string, unknown>;
  if (typeof p.error === "string") return p.error;
  if (typeof p.message === "string") return p.message;
  if (Array.isArray(p.errors) && p.errors.length > 0) {
    const first = p.errors[0];
    if (typeof first === "string") return first;
    if (first && typeof (first as Record<string, unknown>).message === "string")
      return (first as Record<string, unknown>).message as string;
  }
  return fallback;
}

export function normalizeDurationForModel(
  mode: string,
  requestedDuration: string
): string {
  const d = String(requestedDuration);
  if (mode === "runway-image") {
    return ["5", "8", "10"].includes(d) ? d : "5";
  }
  return ["5", "10"].includes(d) ? d : "5";
}

export async function callFreepik(
  pathname: string,
  options: RequestInit = {},
  customApiKey?: string
) {
  const apiKey = customApiKey || process.env.FREEPIK_API_KEY;
  if (!apiKey) {
    const err = new Error("FREEPIK_API_KEY belum diisi") as Error & {
      statusCode: number;
    };
    err.statusCode = 500;
    throw err;
  }

  const response = await fetch(`${freepikBaseUrl}${pathname}`, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-freepik-api-key": apiKey,
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const err = new Error(
      normalizeFreepikError(payload, "Permintaan ke Freepik gagal.")
    ) as Error & { statusCode: number; details: unknown };
    err.statusCode = response.status;
    err.details = payload;
    throw err;
  }

  return payload;
}

export async function readAssetRecords(): Promise<AssetRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("assets")
    .select("*")
    .order("saved_at", { ascending: false });

  if (error) {
    console.error("Error reading assets from Supabase:", error);
    return [];
  }

  return (data || []).map((record: any) => ({
    ...record,
    savedAt: record.saved_at,
    taskId: record.task_id,
    aspectRatio: record.aspect_ratio,
    sourceKind: record.source_kind,
    sourceImageUrl: record.source_image_url,
    remoteVideoUrl: record.remote_video_url,
    fileName: record.file_name,
    storagePath: record.storage_path,
    sizeBytes: record.size_bytes,
  }));
}

export async function writeAssetRecord(record: Omit<AssetRecord, "savedAt">) {
  const { error } = await supabaseAdmin.from("assets").insert([
    {
      id: record.id,
      title: record.title,
      prompt: record.prompt,
      task_id: record.taskId,
      model: record.model,
      aspect_ratio: record.aspectRatio,
      duration: record.duration,
      source_kind: record.sourceKind,
      source_image_url: record.sourceImageUrl,
      remote_video_url: record.remoteVideoUrl,
      file_name: record.fileName,
      storage_path: record.storagePath,
      content_type: record.contentType,
      size_bytes: record.sizeBytes,
    },
  ]);

  if (error) {
    throw new Error(`Error writing asset to Supabase: ${error.message}`);
  }
}

export type AssetRecord = {
  id: string;
  title: string;
  prompt: string;
  taskId: string;
  model: string;
  aspectRatio: string;
  duration: string;
  sourceKind: string;
  sourceImageUrl: string;
  remoteVideoUrl: string;
  fileName: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  savedAt: string;
};

export function sanitizeAssetRecord(asset: AssetRecord) {
  const { storagePath, ...rest } = asset;
  
  // Get public URL for the video
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from("videos")
    .getPublicUrl(storagePath);

  return {
    ...rest,
    streamUrl: publicUrl,
    downloadUrl: publicUrl,
  };
}

export function formatPromptTitle(prompt: string): string {
  const base =
    typeof prompt === "string" && prompt.trim() ? prompt.trim() : "Generated video";
  return base.replace(/\s+/g, " ").slice(0, 60).trim() || "Generated video";
}

export function safeSlug(value: string): string {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "video";
}

export function inferVideoExtension(
  contentType: string,
  remoteUrl: string
): string {
  if (typeof contentType === "string") {
    if (contentType.includes("webm")) return ".webm";
    if (contentType.includes("quicktime")) return ".mov";
    if (contentType.includes("mp4")) return ".mp4";
  }
  try {
    const parsed = new URL(remoteUrl);
    const ext = path.extname(parsed.pathname);
    if (ext) return ext.toLowerCase();
  } catch {
    return ".mp4";
  }
  return ".mp4";
}

export async function downloadAndUploadVideo(
  remoteUrl: string,
  fileName: string
): Promise<{ contentType: string; sizeBytes: number; storagePath: string }> {
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    const err = new Error("Gagal mengunduh video dari sumber remote.") as Error & {
      statusCode: number;
    };
    err.statusCode = response.status;
    throw err;
  }
  
  const contentType = response.headers.get("content-type") || "video/mp4";
  const buffer = await response.arrayBuffer();

  const { data, error } = await supabaseAdmin.storage
    .from("videos")
    .upload(fileName, buffer, {
      contentType,
      upsert: true
    });

  if (error) {
    throw new Error(`Error uploading to Supabase Storage: ${error.message}`);
  }

  return { 
    contentType, 
    sizeBytes: buffer.byteLength,
    storagePath: data.path 
  };
}

export async function deleteAssetRecord(id: string) {
  // First get the record to find the storage path
  const { data: record, error: fetchError } = await supabaseAdmin
    .from("assets")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (fetchError) {
    throw new Error(`Error fetching asset for deletion: ${fetchError.message}`);
  }

  if (record?.storage_path) {
    // Delete from storage
    const { error: storageError } = await supabaseAdmin.storage
      .from("videos")
      .remove([record.storage_path]);
    
    if (storageError) {
      console.warn(`Warning: Failed to delete storage file ${record.storage_path}:`, storageError.message);
    }
  }

  // Delete from database
  const { error: dbError } = await supabaseAdmin
    .from("assets")
    .delete()
    .eq("id", id);

  if (dbError) {
    throw new Error(`Error deleting asset from database: ${dbError.message}`);
  }
}
