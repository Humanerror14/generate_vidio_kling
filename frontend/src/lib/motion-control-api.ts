/**
 * Kling 3 Pro Motion Control API utilities
 * Handles communication with backend for motion control video generation
 */

export type CharacterOrientation = "video" | "image";
export type ReferenceMode = "motion" | "appearance";

export interface MotionControlRequest {
  image_url: string;
  video_url: string;
  prompt?: string;
  character_orientation?: CharacterOrientation;
  cfg_scale?: number;
  webhook_url?: string;
}

export interface MotionControlResponse {
  success: boolean;
  taskId: string;
  status: string;
  model: string;
  data: Record<string, unknown>;
}

export interface MotionControlTaskStatus {
  success: boolean;
  model: string;
  data: {
    status: string;
    video_url?: string;
    url?: string;
    generated?: Array<{
      video_url?: string;
      url?: string;
      src?: string;
    }>;
    [key: string]: unknown;
  };
}

export const MOTION_CONTROL_MODEL = "kling-v3-motion-pro";
export const MOTION_CONTROL_LABEL = "Kling 3 Pro Motion Control";

/**
 * Prepare motion control request payload
 */
export function buildMotionControlPayload(
  imageUrl: string,
  videoUrl: string,
  options?: {
    prompt?: string;
    characterOrientation?: CharacterOrientation;
    cfgScale?: number;
    webhookUrl?: string;
  }
): MotionControlRequest {
  const payload: MotionControlRequest = {
    image_url: imageUrl.trim(),
    video_url: videoUrl.trim(),
  };

  if (options?.prompt?.trim()) {
    payload.prompt = options.prompt.trim();
  }

  if (options?.characterOrientation) {
    payload.character_orientation = options.characterOrientation;
  }

  if (options?.cfgScale !== undefined && options.cfgScale >= 0 && options.cfgScale <= 1) {
    payload.cfg_scale = options.cfgScale;
  }

  if (options?.webhookUrl?.trim()) {
    payload.webhook_url = options.webhookUrl.trim();
  }

  return payload;
}

/**
 * Extract video URL from Freepik API response
 */
export function extractVideoUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;

  // Try direct video_url
  if (typeof record.video_url === "string") {
    return record.video_url;
  }

  // Try generic url field
  if (typeof record.url === "string") {
    return record.url;
  }

  // Try generated array
  if (Array.isArray(record.generated) && record.generated.length > 0) {
    const first = record.generated[0];
    if (typeof first === "string") {
      return first;
    }
    if (first && typeof first === "object") {
      const item = first as Record<string, unknown>;
      if (typeof item.video_url === "string") return item.video_url;
      if (typeof item.url === "string") return item.url;
      if (typeof item.src === "string") return item.src;
    }
  }

  return null;
}

/**
 * Validate motion control inputs
 */
export function validateMotionControlInputs(
  imageUrl: string,
  videoUrl: string
): { valid: boolean; error?: string } {
  if (!imageUrl?.trim()) {
    return { valid: false, error: "Character image URL is required" };
  }

  if (!videoUrl?.trim()) {
    return { valid: false, error: "Reference video URL is required" };
  }

  // Basic URL validation
  try {
    new URL(imageUrl);
  } catch {
    return { valid: false, error: "Invalid character image URL" };
  }

  try {
    new URL(videoUrl);
  } catch {
    return { valid: false, error: "Invalid reference video URL" };
  }

  return { valid: true };
}

/**
 * Get character orientation description
 */
export function getOrientationDescription(orientation: CharacterOrientation): string {
  switch (orientation) {
    case "video":
      return "Matches reference video orientation (complex motion, up to 30s)";
    case "image":
      return "Matches character image orientation (camera movement, up to 10s)";
    default:
      return "";
  }
}

/**
 * Get reference mode description
 */
export function getReferenceDescription(mode: ReferenceMode): string {
  switch (mode) {
    case "motion":
      return "Video will follow motion patterns from reference";
    case "appearance":
      return "Video will follow visual style from reference";
    default:
      return "";
  }
}

/**
 * Check if orientation is compatible with duration
 */
export function isOrientationCompatibleWithDuration(
  orientation: CharacterOrientation,
  duration: number
): boolean {
  if (orientation === "video") {
    return duration <= 30;
  }
  if (orientation === "image") {
    return duration <= 10;
  }
  return true;
}

/**
 * Get recommended orientation for duration
 */
export function getRecommendedOrientation(duration: number): CharacterOrientation {
  return duration > 10 ? "video" : "image";
}
