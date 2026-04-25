/**
 * File and data URL utilities for video/image uploads
 */

export interface FileInfo {
  name: string;
  dataUrl: string;
  sizeLabel: string;
  sizeBytes: number;
}

/**
 * Read file as data URL
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes to readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

/**
 * Validate image file
 */
export async function validateImageFile(
  file: File,
  maxSizeMB = 10
): Promise<{ valid: boolean; error?: string }> {
  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "File must be an image" };
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, error: `Image must be smaller than ${maxSizeMB}MB` };
  }

  return { valid: true };
}

/**
 * Validate video file
 */
export async function validateVideoFile(
  file: File,
  maxSizeMB = 20,
  minDurationSecs = 3,
  maxDurationSecs = 30
): Promise<{ valid: boolean; error?: string; duration?: number }> {
  if (!file.type.startsWith("video/")) {
    return { valid: false, error: "File must be a video" };
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { valid: false, error: `Video must be smaller than ${maxSizeMB}MB` };
  }

  // Try to get video duration
  try {
    const duration = await getVideoDuration(file);
    if (duration < minDurationSecs) {
      return {
        valid: false,
        error: `Video must be at least ${minDurationSecs} seconds`,
        duration,
      };
    }
    if (duration > maxDurationSecs) {
      return {
        valid: false,
        error: `Video must be no longer than ${maxDurationSecs} seconds`,
        duration,
      };
    }
    return { valid: true, duration };
  } catch {
    // If we can't determine duration, allow the upload
    // (backend will validate)
    return { valid: true };
  }
}

/**
 * Get video duration from file
 */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video"));
    };

    video.src = url;
  });
}

/**
 * Process uploaded image file
 */
export async function processImageFile(
  file: File,
  maxSizeMB?: number
): Promise<{ error?: string; file?: FileInfo }> {
  const validation = await validateImageFile(file, maxSizeMB);
  if (!validation.valid) {
    return { error: validation.error };
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      file: {
        name: file.name,
        dataUrl,
        sizeLabel: formatBytes(file.size),
        sizeBytes: file.size,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to process image",
    };
  }
}

/**
 * Process uploaded video file
 */
export async function processVideoFile(
  file: File,
  options?: {
    maxSizeMB?: number;
    minDurationSecs?: number;
    maxDurationSecs?: number;
  }
): Promise<{ error?: string; file?: FileInfo; duration?: number }> {
  const validation = await validateVideoFile(
    file,
    options?.maxSizeMB,
    options?.minDurationSecs,
    options?.maxDurationSecs
  );

  if (!validation.valid) {
    return { error: validation.error, duration: validation.duration };
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      file: {
        name: file.name,
        dataUrl,
        sizeLabel: formatBytes(file.size),
        sizeBytes: file.size,
      },
      duration: validation.duration,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to process video",
    };
  }
}
