import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

export const freepikBaseUrl =
  process.env.FREEPIK_API_BASE_URL || "https://api.freepik.com";
export const defaultModel =
  process.env.FREEPIK_VIDEO_MODEL || "kling-v3-std";

const storageRoot = path.join(os.tmpdir(), "freepik-storage");
export const assetDataDir = path.join(storageRoot, "data");
export const assetVideoDir = path.join(storageRoot, "videos");
export const assetDatabasePath = path.join(assetDataDir, "assets.json");

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

export async function ensureStorage() {
  await fs.mkdir(assetDataDir, { recursive: true });
  await fs.mkdir(assetVideoDir, { recursive: true });
  try {
    await fs.access(assetDatabasePath);
  } catch {
    await fs.writeFile(assetDatabasePath, "[]\n", "utf8");
  }
}

export async function readAssetRecords(): Promise<AssetRecord[]> {
  await ensureStorage();
  try {
    const content = await fs.readFile(assetDatabasePath, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    await fs.writeFile(assetDatabasePath, "[]\n", "utf8");
    return [];
  }
}

export async function writeAssetRecords(records: AssetRecord[]) {
  await ensureStorage();
  await fs.writeFile(
    assetDatabasePath,
    `${JSON.stringify(records, null, 2)}\n`,
    "utf8"
  );
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
  filePath: string;
  contentType: string;
  sizeBytes: number;
  savedAt: string;
};

export function sanitizeAssetRecord(asset: AssetRecord) {
  const { filePath: _fp, ...rest } = asset;
  void _fp;
  return {
    ...rest,
    streamUrl: `/api/assets/${asset.id}/stream`,
    downloadUrl: `/api/assets/${asset.id}/download`,
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

export async function downloadRemoteVideo(
  remoteUrl: string,
  targetPath: string
): Promise<{ contentType: string; sizeBytes: number }> {
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    const err = new Error("Gagal mengunduh video dari sumber remote.") as Error & {
      statusCode: number;
    };
    err.statusCode = response.status;
    throw err;
  }
  const contentType = response.headers.get("content-type") || "video/mp4";
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(targetPath, bytes);
  return { contentType, sizeBytes: bytes.length };
}

export { randomUUID };
