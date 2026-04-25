const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const freepikBaseUrl = process.env.FREEPIK_API_BASE_URL || "https://api.freepik.com";
const defaultModel = process.env.FREEPIK_VIDEO_MODEL || "kling-v3-std";

const storageRoot = path.join(__dirname, "..", "storage");
const assetDataDir = path.join(storageRoot, "data");
const assetVideoDir = path.join(storageRoot, "videos");
const assetDatabasePath = path.join(assetDataDir, "assets.json");

const runwayRatioMap = {
  "16:9": "1280:720",
  "9:16": "720:1280",
  "1:1": "960:960",
};

const runwayDurations = ["5", "8", "10"];
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const durationValues = new Set([
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
]);

const aspectValues = new Set(["16:9", "9:16", "1:1"]);

const modelRegistry = {
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

app.use(
  cors({
    origin: allowedOrigins,
  })
);
app.use(express.json({ limit: "20mb" }));

function getModelConfig(modelId) {
  return modelRegistry[modelId] || modelRegistry[defaultModel] || modelRegistry["kling-v3-std"];
}

function assertFreepikKey() {
  if (!process.env.FREEPIK_API_KEY) {
    const error = new Error("FREEPIK_API_KEY belum diisi di backend/.env");
    error.statusCode = 500;
    throw error;
  }
}

function normalizeFreepikError(payload, fallbackMessage) {
  if (!payload) {
    return fallbackMessage;
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  if (payload.errors && Array.isArray(payload.errors) && payload.errors.length > 0) {
    const firstError = payload.errors[0];

    if (typeof firstError === "string") {
      return firstError;
    }

    if (firstError && typeof firstError.message === "string") {
      return firstError.message;
    }
  }

  return fallbackMessage;
}

function normalizeDurationForModel(modelConfig, duration) {
  if (modelConfig.mode === "runway-image") {
    return runwayDurations.includes(String(duration)) ? String(duration) : "5";
  }

  return String(duration);
}
function normalizeDurationForModel(modelConfig, requestedDuration) {
  const duration = String(requestedDuration);
  if (modelConfig.mode === "runway-image") {
    // Runway 4.5 usually supports 5, 8, 10
    return ["5", "8", "10"].includes(duration) ? duration : "5";
  }
  // Kling usually supports 5, 10
  return ["5", "10"].includes(duration) ? duration : "5";
}


function buildAssetUrls(assetId) {
  return {
    streamUrl: `/api/assets/${assetId}/stream`,
    downloadUrl: `/api/assets/${assetId}/download`,
  };
}

function sanitizeAssetRecord(asset) {
  const { filePath, ...rest } = asset;
  return {
    ...rest,
    ...buildAssetUrls(asset.id),
  };
}

function formatPromptTitle(prompt) {
  const base = typeof prompt === "string" && prompt.trim() ? prompt.trim() : "Generated video";
  const compact = base.replace(/\s+/g, " ").slice(0, 60).trim();

  return compact || "Generated video";
}

function safeSlug(value) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "video";
}

function inferVideoExtension(contentType, remoteUrl) {
  if (typeof contentType === "string") {
    if (contentType.includes("webm")) {
      return ".webm";
    }

    if (contentType.includes("quicktime")) {
      return ".mov";
    }

    if (contentType.includes("mp4")) {
      return ".mp4";
    }
  }

  try {
    const parsed = new URL(remoteUrl);
    const ext = path.extname(parsed.pathname);

    if (ext) {
      return ext.toLowerCase();
    }
  } catch {
    return ".mp4";
  }

  return ".mp4";
}

async function ensureStorage() {
  await fs.mkdir(assetDataDir, { recursive: true });
  await fs.mkdir(assetVideoDir, { recursive: true });

  try {
    await fs.access(assetDatabasePath);
  } catch {
    await fs.writeFile(assetDatabasePath, "[]\n", "utf8");
  }
}

async function readAssetRecords() {
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

async function writeAssetRecords(records) {
  await ensureStorage();
  await fs.writeFile(assetDatabasePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

async function getAssetRecordOrThrow(assetId) {
  const records = await readAssetRecords();
  const record = records.find((item) => item.id === assetId);

  if (!record) {
    const error = new Error("Asset tidak ditemukan.");
    error.statusCode = 404;
    throw error;
  }

  return record;
}

async function downloadRemoteVideo(remoteUrl, targetPath) {
  const response = await fetch(remoteUrl);

  if (!response.ok) {
    const error = new Error("Gagal mengunduh video dari sumber remote.");
    error.statusCode = response.status;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "video/mp4";
  const bytes = Buffer.from(await response.arrayBuffer());

  await fs.writeFile(targetPath, bytes);

  return {
    contentType,
    sizeBytes: bytes.length,
  };
}

async function callFreepik(pathname, options = {}, customApiKey = null) {
  const apiKey = customApiKey || process.env.FREEPIK_API_KEY;
  if (!apiKey) {
    const error = new Error("FREEPIK_API_KEY belum diisi di backend/.env dan tidak diberikan oleh user");
    error.statusCode = 500;
    throw error;
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
    if (response.status !== 404) {
      console.error("Freepik API Error:", {
        status: response.status,
        pathname,
        payload: payload
      });
    } else {
      // Quiet log for 404 to avoid confusing the user during task listing
      console.warn(`Freepik Resource Not Found (404): ${pathname}`);
    }
    
    const error = new Error(
      normalizeFreepikError(payload, "Permintaan ke Freepik gagal.")
    );
    error.statusCode = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

app.get("/api/health", async (_request, response, next) => {
  try {
    const assets = await readAssetRecords();

    response.json({
      ok: true,
      freepikConfigured: Boolean(process.env.FREEPIK_API_KEY),
      userKeySupported: true,
      defaultModel,
      availableModels: Object.keys(modelRegistry),
      storedAssets: assets.length,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/video/generate", async (request, response, next) => {
  try {
    const {
      prompt,
      negativePrompt,
      model = defaultModel,
      aspectRatio = "16:9",
      duration = "5",
      generateAudio = true,
      startImageUrl,
      endImageUrl,
      localStartImageDataUrl,
      webhookUrl,
      cfgScale = 0.5,
      cameraControl,
      videoReferenceUrl,
      localVideoReferenceDataUrl,
      motionStrength,
      referenceMode,
      characterOrientation,
      apiKey,
    } = request.body || {};

    const requestedModel = getModelConfig(model);
    const shouldUseRunwayUpload =
      typeof localStartImageDataUrl === "string" &&
      localStartImageDataUrl.startsWith("data:image/");
    const selectedModel = shouldUseRunwayUpload
      ? modelRegistry["runway-4-5-i2v"]
      : requestedModel;

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return response.status(400).json({
        error: "Prompt wajib diisi sebelum generate video.",
      });
    }

    if (!aspectValues.has(String(aspectRatio))) {
      return response.status(400).json({
        error: "Aspect ratio harus 16:9, 9:16, atau 1:1.",
      });
    }

    if (
      selectedModel.mode !== "runway-image" &&
      !durationValues.has(String(duration))
    ) {
      return response.status(400).json({
        error: "Durasi video Freepik harus di antara 3 sampai 15 detik.",
      });
    }

    const parsedCfgScale = Number(cfgScale);

    if (Number.isNaN(parsedCfgScale) || parsedCfgScale < 0 || parsedCfgScale > 1) {
      return response.status(400).json({
        error: "CFG scale harus berada di rentang 0 sampai 1.",
      });
    }

    let payload;

    if (selectedModel.mode === "runway-image") {
      const imageInput =
        shouldUseRunwayUpload && typeof localStartImageDataUrl === "string"
          ? localStartImageDataUrl
          : typeof startImageUrl === "string" && startImageUrl.trim()
            ? startImageUrl.trim()
            : "";

      if (!imageInput) {
        return response.status(400).json({
          error:
            "Upload atau URL gambar sumber wajib diisi untuk mode Runway image-to-video.",
        });
      }

      payload = {
        image: imageInput,
        prompt: prompt.trim(),
        ratio: runwayRatioMap[String(aspectRatio)] || "1280:720",
        duration: Number(normalizeDurationForModel(selectedModel, duration)),
        webhook_url:
          typeof webhookUrl === "string" && webhookUrl.trim()
            ? webhookUrl.trim()
            : undefined,
      };
    } else if (selectedModel.mode === "kling-motion") {
      const videoRef = (videoReferenceUrl || localVideoReferenceDataUrl || "").trim();
      const imageInput = localStartImageDataUrl || startImageUrl || "";

      if (!videoRef || !imageInput) {
        return response.status(400).json({
          error: "Motion Control Pro memerlukan gambar karakter (image_url) dan video referensi (video_url).",
        });
      }

      payload = {
        image_url: imageInput,
        video_url: videoRef,
        prompt: prompt.trim() || undefined,
        character_orientation: characterOrientation || "video",
        cfg_scale: parsedCfgScale,
        webhook_url: webhookUrl || undefined,
      };
    } else {
      payload = {
        prompt: prompt.trim(),
        aspect_ratio: String(aspectRatio),
        duration: normalizeDurationForModel(selectedModel, duration),
        generate_audio: Boolean(generateAudio),
        negative_prompt:
          typeof negativePrompt === "string" && negativePrompt.trim()
            ? negativePrompt.trim()
            : undefined,
        webhook_url:
          typeof webhookUrl === "string" && webhookUrl.trim()
            ? webhookUrl.trim()
            : undefined,
        cfg_scale: parsedCfgScale,
        end_image_url:
          typeof endImageUrl === "string" && endImageUrl.trim()
            ? endImageUrl.trim()
            : undefined,
      };

      if (typeof startImageUrl === "string" && startImageUrl.trim()) {
        payload[selectedModel.startImageField] = startImageUrl.trim();
      }

      const videoRef = (videoReferenceUrl || localVideoReferenceDataUrl || "").trim();
      if (videoRef) {
        payload.video_url = videoRef;
      }

      if (motionStrength !== undefined && motionStrength !== null) {
        payload.motion = Number(motionStrength);
      }

      if (referenceMode) {
        payload.reference_mode = referenceMode;
      }

      if (cameraControl) {
        const { type, value } = cameraControl;
        const config = { horizontal: 0, vertical: 0, zoom: 0, roll: 0 };
        
        if (type === "pan_left") config.horizontal = -5.0;
        else if (type === "pan_right") config.horizontal = 5.0;
        else if (type === "tilt_up") config.vertical = 5.0;
        else if (type === "tilt_down") config.vertical = -5.0;
        else if (type === "zoom_in") config.zoom = 5.0;
        else if (type === "zoom_out") config.zoom = -5.0;
        else if (type === "roll_cw") config.roll = 5.0;
        else if (type === "roll_ccw") config.roll = -5.0;
        
        payload.camera_control = config;
      }
    }

    console.log("Submitting to Freepik:", {
      model: selectedModel.label,
      payloadSize: JSON.stringify(payload).length,
      hasKey: Boolean(apiKey),
      isMotionControl: selectedModel.mode === "kling-motion",
      hasImageUrl: Boolean(payload.image_url || payload.image),
      hasVideoUrl: Boolean(payload.video_url),
      promptSnippet: payload.prompt ? payload.prompt.slice(0, 50) : "N/A"
    });

    // Log the start of payload to check if it's base64
    if (payload.image_url && payload.image_url.startsWith("data:")) {
      console.log("Image input is a Data URL (Base64)");
    }
    if (payload.video_url && payload.video_url.startsWith("data:")) {
      console.log("Video input is a Data URL (Base64)");
    }

    const result = await callFreepik(selectedModel.submitPath, {
      method: "POST",
      body: JSON.stringify(payload),
    }, apiKey);

    const data = result.data || result;
    const taskId = data.task_id || data.id;

    response.json({
      success: true,
      model: Object.keys(modelRegistry).find(
        (modelId) => modelRegistry[modelId] === selectedModel
      ),
      requestedModel: model,
      modelLabel: selectedModel.label,
      taskId,
      status: data.status || "CREATED",
      data,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/video/tasks", async (request, response, next) => {
  try {
    const model = String(request.query.model || defaultModel);
    const selectedModel = getModelConfig(model);
    const apiKey = request.query.apiKey || undefined;

    let result;
    try {
      result = await callFreepik(selectedModel.taskBasePath, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }, apiKey);
    } catch (error) {
      // If Freepik returns 404 for the task list (common if no tasks exist), return empty array
      if (error.statusCode === 404) {
        return response.json({
          success: true,
          model,
          data: [],
        });
      }
      throw error;
    }

    response.json({
      success: true,
      model,
      data: result.data || result,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/video/tasks/:taskId", async (request, response, next) => {
  try {
    const { taskId } = request.params;
    const model = String(request.query.model || defaultModel);
    const selectedModel = getModelConfig(model);

    if (!taskId) {
      return response.status(400).json({
        error: "Task ID wajib diisi.",
      });
    }

    const apiKey = request.query.apiKey || undefined;

    const result = await callFreepik(
      `${selectedModel.taskBasePath}/${encodeURIComponent(taskId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      apiKey
    );

    response.json({
      success: true,
      model,
      data: result.data || result,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/assets", async (_request, response, next) => {
  try {
    const records = await readAssetRecords();
    const assets = records
      .slice()
      .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime())
      .map(sanitizeAssetRecord);

    response.json({
      success: true,
      assets,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/assets/save", async (request, response, next) => {
  try {
    const {
      taskId,
      prompt,
      model,
      videoUrl,
      aspectRatio,
      duration,
      sourceKind,
      sourceImageUrl,
    } = request.body || {};

    if (typeof videoUrl !== "string" || videoUrl.trim().length === 0) {
      return response.status(400).json({
        error: "Video URL wajib tersedia sebelum asset bisa disimpan.",
      });
    }

    const records = await readAssetRecords();
    const existing = records.find(
      (item) =>
        (taskId && item.taskId === taskId) ||
        item.remoteVideoUrl === videoUrl.trim()
    );

    if (existing) {
      return response.json({
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

    response.status(201).json({
      success: true,
      asset: sanitizeAssetRecord(assetRecord),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/assets/:assetId/stream", async (request, response, next) => {
  try {
    const asset = await getAssetRecordOrThrow(request.params.assetId);
    response.type(asset.contentType || "video/mp4");
    response.sendFile(asset.filePath);
  } catch (error) {
    next(error);
  }
});

app.get("/api/assets/:assetId/download", async (request, response, next) => {
  try {
    const asset = await getAssetRecordOrThrow(request.params.assetId);
    response.download(asset.filePath, asset.fileName);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/assets/:assetId", async (request, response, next) => {
  try {
    const assetId = request.params.assetId;
    const records = await readAssetRecords();
    const record = records.find((item) => item.id === assetId);

    if (!record) {
      return response.status(404).json({
        error: "Asset tidak ditemukan.",
      });
    }

    try {
      await fs.rm(record.filePath, { force: true });
    } catch {
      // Ignore missing local file and continue metadata cleanup.
    }

    const nextRecords = records.filter((item) => item.id !== assetId);
    await writeAssetRecords(nextRecords);

    response.json({
      success: true,
      assetId,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/webhooks/freepik", async (request, response, next) => {
  try {
    const payload = request.body || {};
    
    console.log("Webhook received from Freepik:", {
      taskId: payload.task_id || payload.id,
      status: payload.status,
      timestamp: new Date().toISOString(),
    });

    // Verify webhook signature if needed (optional - implement based on Freepik docs)
    // For now, we acknowledge receipt and log for debugging
    
    response.status(200).json({
      success: true,
      received: true,
      taskId: payload.task_id || payload.id,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Always return 200 to prevent Freepik retries for processing errors
    response.status(200).json({
      success: false,
      error: error.message,
    });
  }
});

app.use((error, _request, response, _next) => {
  if (error?.type === "entity.too.large") {
    return response.status(413).json({
      error:
        "Ukuran upload terlalu besar untuk diproses. Gunakan gambar di bawah 10MB.",
      details: null,
    });
  }

  const statusCode = error.statusCode || 500;

  response.status(statusCode).json({
    error: error.message || "Terjadi kesalahan pada server.",
    details: error.details || null,
  });
});

ensureStorage()
  .catch((error) => {
    console.error("Failed to prepare storage:", error);
  })
  .finally(() => {
    app.listen(port, () => {
      console.log(`Freepik backend listening on http://localhost:${port}`);
    });
  });
