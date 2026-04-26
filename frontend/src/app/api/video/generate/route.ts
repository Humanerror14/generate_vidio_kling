import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import {
  callFreepik,
  getModelConfig,
  modelRegistry,
  defaultModel,
  normalizeDurationForModel,
} from "@/lib/backend";

const runwayRatioMap: Record<string, string> = {
  "16:9": "1280:720",
  "9:16": "720:1280",
  "1:1": "960:960",
};
const aspectValues = new Set(["16:9", "9:16", "1:1"]);
const durationValues = new Set(["3","4","5","6","7","8","9","10","11","12","13","14","15"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
    } = body || {};

    const selectedModel = getModelConfig(model);

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt wajib diisi sebelum generate video." },
        { status: 400 }
      );
    }

    if (!aspectValues.has(String(aspectRatio))) {
      return NextResponse.json(
        { error: "Aspect ratio harus 16:9, 9:16, atau 1:1." },
        { status: 400 }
      );
    }

    if (
      selectedModel.mode !== "runway-image" &&
      !durationValues.has(String(duration))
    ) {
      return NextResponse.json(
        { error: "Durasi video harus di antara 3 sampai 15 detik." },
        { status: 400 }
      );
    }

    const parsedCfgScale = Number(cfgScale);
    if (Number.isNaN(parsedCfgScale) || parsedCfgScale < 0 || parsedCfgScale > 1) {
      return NextResponse.json(
        { error: "CFG scale harus berada di rentang 0 sampai 1." },
        { status: 400 }
      );
    }

    let payload: Record<string, unknown>;

    if (selectedModel.mode === "runway-image") {
      const imageInput = (localStartImageDataUrl || startImageUrl || "").toString().trim();
      if (!imageInput) {
        return NextResponse.json(
          { error: "Upload atau URL gambar sumber wajib diisi untuk mode Runway." },
          { status: 400 }
        );
      }
      payload = {
        image: imageInput,
        prompt: prompt.trim(),
        ratio: runwayRatioMap[String(aspectRatio)] || "1280:720",
        duration: Number(normalizeDurationForModel(selectedModel.mode, duration)),
        webhook_url: typeof webhookUrl === "string" && webhookUrl.trim() ? webhookUrl.trim() : undefined,
      };
    } else if (selectedModel.mode === "kling-motion") {
      const imageInput = (localStartImageDataUrl || startImageUrl || "").toString().trim();
      const videoRef = (localVideoReferenceDataUrl || videoReferenceUrl || "").toString().trim();
      
      console.log("Backend Motion Control Debug:", { model, imageInput: imageInput.slice(0, 100), videoRef: videoRef.slice(0, 100) });

      if (!imageInput || !videoRef) {
        return NextResponse.json(
          { error: "Motion Control Pro memerlukan gambar karakter dan video referensi." },
          { status: 400 }
        );
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
        duration: normalizeDurationForModel(selectedModel.mode, duration),
        generate_audio: Boolean(generateAudio),
        negative_prompt: typeof negativePrompt === "string" && negativePrompt.trim() ? negativePrompt.trim() : undefined,
        webhook_url: typeof webhookUrl === "string" && webhookUrl.trim() ? webhookUrl.trim() : undefined,
        cfg_scale: parsedCfgScale,
        end_image_url: typeof endImageUrl === "string" && endImageUrl.trim() ? endImageUrl.trim() : undefined,
      };
      if (typeof startImageUrl === "string" && startImageUrl.trim()) {
        payload[selectedModel.startImageField] = startImageUrl.trim();
      }
      const videoRef = (videoReferenceUrl || localVideoReferenceDataUrl || "").trim();
      if (videoRef) payload.video_url = videoRef;
      if (motionStrength !== undefined && motionStrength !== null) {
        payload.motion = Number(motionStrength);
      }
      if (referenceMode) payload.reference_mode = referenceMode;
      if (cameraControl) {
        const { type } = cameraControl;
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

    const result = await callFreepik(
      selectedModel.submitPath,
      { method: "POST", body: JSON.stringify(payload) },
      apiKey
    );

    const data = result.data || result;
    const taskId = data.task_id || data.id;

    return NextResponse.json({
      success: true,
      model: Object.keys(modelRegistry).find((k) => modelRegistry[k] === selectedModel),
      requestedModel: model,
      modelLabel: selectedModel.label,
      taskId,
      status: data.status || "CREATED",
      data,
    });
  } catch (err) {
    const e = err as Error & { statusCode?: number; details?: unknown };
    return NextResponse.json(
      { error: e.message || "Terjadi kesalahan pada server.", details: e.details || null },
      { status: e.statusCode || 500 }
    );
  }
}
