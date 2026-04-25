"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
} from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  BadgeCheck,
  CheckCircle2,
  Clapperboard,
  Clock3,
  Download,
  Film,
  FolderOpen,
  ImagePlus,
  LoaderCircle,
  RefreshCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  WandSparkles,
} from "lucide-react";
import { MotionControlForm } from "@/components/MotionControlForm";

const backendBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 
  (typeof window !== "undefined" && window.location.hostname !== "localhost" ? "/api" : "http://localhost:4000/api");

const modelCatalog = [
  {
    id: "kling-v3-std",
    name: "Kling 3.0 Standard",
    badge: "Motion Control",
    description: "Mendukung kontrol kamera dan referensi gerakan video.",
  },
  {
    id: "kling-v3-pro",
    name: "Kling 3.0 Pro",
    badge: "Motion Control + High Detail",
    description: "Kualitas sinematik dengan kontrol gerakan presisi.",
  },
  {
    id: "kling-v3-motion-pro",
    name: "Kling 3 Pro Motion Control",
    badge: "Transfer Motion",
    description: "Transfer motion from reference video to character image with precision control.",
  },
  {
    id: "kling-v3-omni-std",
    name: "Kling 3.0 Omni",
    badge: "Motion Control + Reference",
    description: "Terbaik untuk sinkronisasi gerakan dengan video referensi.",
  },
  {
    id: "runway-4-5-i2v",
    name: "Runway 4.5 Image",
    badge: "Upload Ready",
    description: "Mode terbaik untuk upload lokal karena menerima Base64 image.",
  },
] as const;

const aspectRatioOptions = ["16:9", "9:16", "1:1"] as const;
const klingDurations = ["3", "5", "8", "10", "15"] as const;
const runwayDurations = ["5", "8", "10"] as const;
const promptPresets = [
  "Futuristic control room with cinematic blue lighting, smooth dolly in, reflective surfaces, premium product commercial look.",
  "Stylized rainy alley in Tokyo, neon signage, steam, shallow depth of field, dramatic handheld camera drift.",
  "Minimal luxury watch showcase on obsidian glass, slow orbit motion, crisp highlights, dark studio background.",
  "Fantasy landscape above the clouds, towering temples, sunlight rays, majestic aerial motion, dreamlike realism.",
];

const cameraControlOptions = [
  { id: "none", label: "No Motion" },
  { id: "pan_left", label: "Pan Left" },
  { id: "pan_right", label: "Pan Right" },
  { id: "tilt_up", label: "Tilt Up" },
  { id: "tilt_down", label: "Tilt Down" },
  { id: "zoom_in", label: "Zoom In" },
  { id: "zoom_out", label: "Zoom Out" },
  { id: "roll_cw", label: "Roll CW" },
  { id: "roll_ccw", label: "Roll CCW" },
] as const;

const progressStatuses = new Set([
  "CREATED",
  "QUEUED",
  "SUBMITTING",
  "POLLING",
  "IN_PROGRESS",
  "PROCESSING",
]);

const successStatuses = new Set(["COMPLETED", "SUCCEEDED"]);
const errorStatuses = new Set(["FAILED", "ERROR", "CANCELLED"]);

type ModelId = (typeof modelCatalog)[number]["id"];
type AspectRatio = (typeof aspectRatioOptions)[number];

type UploadedImage = {
  name: string;
  dataUrl: string;
  sizeLabel: string;
};

type UploadedVideo = {
  name: string;
  dataUrl: string;
  sizeLabel: string;
};

type FormState = {
  prompt: string;
  negativePrompt: string;
  model: ModelId;
  aspectRatio: AspectRatio;
  duration: string;
  generateAudio: boolean;
  startImageUrl: string;
  endImageUrl: string;
  webhookUrl: string;
  cfgScale: number;
  cameraControl: string;
  videoReferenceUrl: string;
  motionStrength: number;
  referenceMode: "motion" | "appearance";
  characterOrientation: "video" | "image";
};

type HealthState = {
  online: boolean;
  freepikConfigured: boolean;
  storedAssets: number;
  message?: string;
};

type GenerationState = {
  taskId: string;
  model: ModelId;
  status: string;
  videoUrl: string | null;
  error: string | null;
  promptSnapshot: string;
  aspectRatio: AspectRatio;
  duration: string;
  sourceKind: string;
  sourceImageUrl: string;
};

type AssetRecord = {
  id: string;
  title: string;
  prompt: string;
  taskId: string;
  model: ModelId;
  aspectRatio: string;
  duration: string;
  sourceKind: string;
  sourceImageUrl: string;
  remoteVideoUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  savedAt: string;
  streamUrl: string;
  downloadUrl: string;
};

type SaveState = {
  isSaving: boolean;
  error: string | null;
};

function getBackendOrigin(baseUrl: string) {
  if (baseUrl.startsWith("/")) {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
  try {
    return new URL(baseUrl).origin;
  } catch {
    return "http://localhost:4000";
  }
}

function extractGeneratedUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const maybeRecord = payload as {
    generated?: unknown;
    video_url?: unknown;
    url?: unknown;
  };

  if (typeof maybeRecord.video_url === "string") {
    return maybeRecord.video_url;
  }

  if (typeof maybeRecord.url === "string") {
    return maybeRecord.url;
  }

  if (Array.isArray(maybeRecord.generated) && maybeRecord.generated.length > 0) {
    const firstItem = maybeRecord.generated[0];

    if (typeof firstItem === "string") {
      return firstItem;
    }

    if (firstItem && typeof firstItem === "object") {
      const generatedRecord = firstItem as {
        video_url?: unknown;
        url?: unknown;
        src?: unknown;
      };

      if (typeof generatedRecord.video_url === "string") {
        return generatedRecord.video_url;
      }

      if (typeof generatedRecord.url === "string") {
        return generatedRecord.url;
      }

      if (typeof generatedRecord.src === "string") {
        return generatedRecord.src;
      }
    }
  }

  return null;
}

function getStatusTone(status: string) {
  if (successStatuses.has(status)) {
    return "success";
  }

  if (errorStatuses.has(status)) {
    return "danger";
  }

  if (progressStatuses.has(status)) {
    return "progress";
  }

  return "neutral";
}

function normalizeDurationForModel(duration: string, model: ModelId) {
  if (model === "runway-4-5-i2v") {
    return runwayDurations.includes(
      duration as (typeof runwayDurations)[number]
    )
      ? duration
      : "5";
  }

  return klingDurations.includes(duration as (typeof klingDurations)[number])
    ? duration
    : "5";
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} B`;
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return value;
  }

  const difference = Date.now() - timestamp;
  const minutes = Math.floor(difference / 60000);

  if (minutes < 1) {
    return "Baru saja";
  }

  if (minutes < 60) {
    return `${minutes} menit lalu`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} jam lalu`;
  }

  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Browser tidak bisa membaca file gambar."));
    };

    reader.onerror = () => {
      reject(new Error("Gagal membaca file gambar."));
    };

    reader.readAsDataURL(file);
  });
}

function triggerBrowserDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function getSourceKind(uploadedImage: UploadedImage | null, startImageUrl: string) {
  if (uploadedImage) {
    return "Uploaded image";
  }

  if (startImageUrl.trim()) {
    return "Remote image";
  }

  return "Prompt only";
}

export default function Home() {
  const backendOrigin = getBackendOrigin(backendBaseUrl);
  const startImageInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>({
    prompt:
      "A high-end cinematic interface demo for an AI video studio, glowing orange accents, elegant camera glide, premium depth and subtle reflections.",
    negativePrompt: "distortion, blur, low quality, noisy background",
    model: "kling-v3-std",
    aspectRatio: "16:9",
    duration: "5",
    generateAudio: true,
    startImageUrl: "",
    endImageUrl: "",
    webhookUrl: "",
    cfgScale: 0.5,
    cameraControl: "none",
    videoReferenceUrl: "",
    motionStrength: 8,
    referenceMode: "motion",
    characterOrientation: "video",
  });
  const [apiKey, setApiKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [uploadedVideoReference, setUploadedVideoReference] = useState<UploadedVideo | null>(null);
  const [health, setHealth] = useState<HealthState>({
    online: false,
    freepikConfigured: false,
    storedAssets: 0,
  });
  const [uploadedStartImage, setUploadedStartImage] =
    useState<UploadedImage | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({
    isSaving: false,
    error: null,
  });
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [remoteTasks, setRemoteTasks] = useState<any[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [isLoadingRemoteTasks, setIsLoadingRemoteTasks] = useState(false);
  const [generation, setGeneration] = useState<GenerationState>({
    taskId: "",
    model: "kling-v3-std",
    status: "IDLE",
    videoUrl: null,
    error: null,
    promptSnapshot: "",
    aspectRatio: "16:9",
    duration: "5",
    sourceKind: "Prompt only",
    sourceImageUrl: "",
  });

  const deferredPrompt = useDeferredValue(form.prompt);

  const selectedModel =
    modelCatalog.find((option) => option.id === form.model) ?? modelCatalog[0];
  const currentSavedAsset = generation.taskId
    ? assets.find((asset) => asset.taskId === generation.taskId) ?? null
    : null;
  const currentPlaybackUrl = currentSavedAsset
    ? `${backendOrigin}${currentSavedAsset.streamUrl}`
    : generation.videoUrl;
  const durationOptions =
    form.model === "runway-4-5-i2v" ? runwayDurations : klingDurations;
  const stageTone = getStatusTone(generation.status);
  const canSaveCurrentAsset = Boolean(
    generation.videoUrl && successStatuses.has(generation.status)
  );
  const stageGlow = {
    "--stage-glow":
      stageTone === "success"
        ? "rgba(93, 214, 184, 0.35)"
        : stageTone === "danger"
          ? "rgba(255, 103, 137, 0.28)"
          : "rgba(255, 162, 79, 0.28)",
  } as CSSProperties;

  const refreshHealth = async () => {
    try {
      const response = await fetch(`${backendBaseUrl}/health?t=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error("Backend tidak merespons.");
      }

      const payload = (await response.json()) as {
        freepikConfigured?: boolean;
        storedAssets?: number;
        userKeySupported?: boolean;
      };

      setHealth({
        online: true,
        freepikConfigured: Boolean(payload.freepikConfigured),
        storedAssets: Number(payload.storedAssets || 0),
      });
    } catch (error) {
      setHealth({
        online: false,
        freepikConfigured: false,
        storedAssets: 0,
        message:
          error instanceof Error ? error.message : "Backend tidak tersedia.",
      });
    }
  };

  const loadAssets = async () => {
    try {
      setIsLoadingAssets(true);
      const response = await fetch(`${backendBaseUrl}/assets`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Gagal membaca library asset.");
      }

      const payload = (await response.json()) as {
        assets?: AssetRecord[];
      };

      setAssets(Array.isArray(payload.assets) ? payload.assets : []);
    } catch {
      setAssets([]);
    } finally {
      setIsLoadingAssets(false);
    }
  };

  const loadRemoteTasks = async () => {
    try {
      setIsLoadingRemoteTasks(true);
      const url = new URL(`${backendBaseUrl}/video/tasks`);
      url.searchParams.append("model", form.model);
      if (apiKey) {
        url.searchParams.append("apiKey", apiKey);
      }

      const response = await fetch(url.toString(), {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Gagal membaca remote tasks.");
      }

      const payload = (await response.json()) as {
        data?: any[];
      };

      setRemoteTasks(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setRemoteTasks([]);
    } finally {
      setIsLoadingRemoteTasks(false);
    }
  };

  async function requestTaskStatus(taskId: string, model: ModelId, customApiKey?: string) {
    const url = new URL(`${backendBaseUrl}/video/tasks/${taskId}`);
    url.searchParams.append("model", model);
    if (customApiKey) {
      url.searchParams.append("apiKey", customApiKey);
    }

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 401) {
        handleLogout();
        throw new Error("Sesi berakhir karena limit atau key tidak valid.");
      }
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Gagal memeriksa status task.");
    }

    const payload = (await response.json()) as {
      data?: Record<string, unknown>;
    };

    return {
      status:
        typeof payload.data?.status === "string"
          ? payload.data.status
          : "POLLING",
      videoUrl: extractGeneratedUrl(payload.data),
    };
  }

  useEffect(() => {
    const savedKey = localStorage.getItem("freepik_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      setIsAuthenticated(true);
    }

    const timeoutId = window.setTimeout(() => {
      void Promise.all([refreshHealth(), loadAssets(), loadRemoteTasks()]);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const pollTask = useEffectEvent(async () => {
    if (!generation.taskId || successStatuses.has(generation.status) || errorStatuses.has(generation.status)) {
      return;
    }

    try {
      const next = await requestTaskStatus(generation.taskId, generation.model, apiKey);

      startTransition(() => {
        setGeneration((current) => ({
          ...current,
          status: next.status,
          videoUrl: next.videoUrl ?? current.videoUrl,
          error:
            errorStatuses.has(next.status)
              ? "Freepik menandai task ini gagal diproses."
              : null,
        }));
      });
    } catch (error) {
      setGeneration((current) => ({
        ...current,
        status: "ERROR",
        error:
          error instanceof Error
            ? error.message
            : "Gagal memeriksa status task.",
      }));
    }
  });

  useEffect(() => {
    if (!generation.taskId || successStatuses.has(generation.status) || errorStatuses.has(generation.status)) {
      return;
    }

    const immediateId = window.setTimeout(() => {
      void pollTask();
    }, 0);

    const intervalId = window.setInterval(() => {
      void pollTask();
    }, 5000);

    return () => {
      window.clearTimeout(immediateId);
      window.clearInterval(intervalId);
    };
  }, [generation.taskId, generation.status]);

  async function handleModelChange(model: ModelId) {
    setForm((current) => ({
      ...current,
      model,
      duration: normalizeDurationForModel(current.duration, model),
      generateAudio: model === "runway-4-5-i2v" ? false : current.generateAudio,
    }));
    void loadRemoteTasks();
  }

  async function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("File yang dipilih harus berupa gambar.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Ukuran gambar maksimal 10MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);

      setUploadedStartImage({
        name: file.name,
        dataUrl,
        sizeLabel: formatBytes(file.size),
      });
      setUploadError(null);
      setForm((current) => ({
        ...current,
        startImageUrl: "",
        model: "runway-4-5-i2v",
        duration: normalizeDurationForModel(current.duration, "runway-4-5-i2v"),
        generateAudio: false,
      }));
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Gagal memuat gambar."
      );
    }
  }

  async function handleSourceImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      await handleImageFile(file);
    }
  }

  async function handleDropUpload(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDraggingUpload(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      await handleImageFile(file);
    }
  }

  function clearUploadedImage() {
    setUploadedStartImage(null);
    setUploadError(null);
  }

  function openSourcePicker() {
    startImageInputRef.current?.click();
  }

  async function handleVideoFile(file: File) {
    if (!file.type.startsWith("video/")) {
      setUploadError("File yang dipilih harus berupa video.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError("Ukuran video maksimal 20MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setUploadedVideoReference({
        name: file.name,
        dataUrl,
        sizeLabel: formatBytes(file.size),
      });
      setUploadError(null);
    } catch (error) {
      setUploadError("Gagal memuat video.");
    }
  }

  async function handleGenerate() {
    if (!form.prompt.trim()) {
      setGeneration((current) => ({
        ...current,
        status: "ERROR",
        error: "Prompt video masih kosong.",
      }));
      return;
    }

    if (
      form.model === "runway-4-5-i2v" &&
      !uploadedStartImage &&
      !form.startImageUrl.trim()
    ) {
      setGeneration((current) => ({
        ...current,
        status: "ERROR",
        error:
          "Mode Runway 4.5 Image membutuhkan upload gambar atau URL gambar sumber.",
      }));
      return;
    }

    setSaveState({
      isSaving: false,
      error: null,
    });
    setIsSubmitting(true);
    setGeneration({
      taskId: "",
      model: form.model,
      status: "SUBMITTING",
      videoUrl: null,
      error: null,
      promptSnapshot: form.prompt,
      aspectRatio: form.aspectRatio,
      duration: form.duration,
      sourceKind: getSourceKind(uploadedStartImage, form.startImageUrl),
      sourceImageUrl: form.startImageUrl,
    });

    try {
      const response = await fetch(`${backendBaseUrl}/video/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: form.prompt,
          negativePrompt: form.negativePrompt,
          model: form.model,
          aspectRatio: form.aspectRatio,
          duration: form.duration,
          generateAudio: form.generateAudio,
          startImageUrl: form.startImageUrl,
          endImageUrl: form.endImageUrl,
          localStartImageDataUrl: uploadedStartImage?.dataUrl ?? "",
          webhookUrl: form.webhookUrl,
          cfgScale: form.cfgScale,
          cameraControl: form.cameraControl !== "none" ? { type: form.cameraControl, value: 1.0 } : undefined,
          videoReferenceUrl: form.videoReferenceUrl,
          localVideoReferenceDataUrl: uploadedVideoReference?.dataUrl ?? "",
          motionStrength: form.motionStrength,
          referenceMode: form.referenceMode,
          characterOrientation: form.characterOrientation,
          apiKey: apiKey || undefined,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        taskId?: string;
        status?: string;
        model?: ModelId;
      };

      if (!response.ok || !payload.taskId) {
        const errorMsg = payload.error ?? "Gagal membuat task video.";
        const isLimit = response.status === 429 || 
                        response.status === 401 || 
                        errorMsg.toLowerCase().includes("limit") || 
                        errorMsg.toLowerCase().includes("quota") ||
                        errorMsg.toLowerCase().includes("trial") ||
                        errorMsg.toLowerCase().includes("upgrade");

        if (isLimit) {
          handleLogout();
          throw new Error("Limit tercapai (Free Trial habis). Silakan gunakan API Key lain yang masih aktif.");
        }
        throw new Error(errorMsg);
      }

      setGeneration({
        taskId: payload.taskId,
        model: payload.model ?? form.model,
        status: payload.status ?? "CREATED",
        videoUrl: null,
        error: null,
        promptSnapshot: form.prompt,
        aspectRatio: form.aspectRatio,
        duration: form.duration,
        sourceKind: getSourceKind(uploadedStartImage, form.startImageUrl),
        sourceImageUrl: form.startImageUrl,
      });
    } catch (error) {
      console.error("Generation error:", error);
      setGeneration((current) => ({
        ...current,
        taskId: "",
        status: "ERROR",
        videoUrl: null,
        error:
          error instanceof Error ? error.message : "Gagal mengirim prompt.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefreshCurrentTask() {
    if (!generation.taskId) {
      return;
    }

    try {
      const next = await requestTaskStatus(generation.taskId, generation.model, apiKey);
      setGeneration((current) => ({
        ...current,
        status: next.status,
        videoUrl: next.videoUrl ?? current.videoUrl,
        error: null,
      }));
    } catch (error) {
      setGeneration((current) => ({
        ...current,
        error:
          error instanceof Error
            ? error.message
            : "Gagal membaca status task.",
      }));
    }
  }

  async function saveCurrentAsset(downloadAfter = false) {
    if (currentSavedAsset) {
      if (downloadAfter) {
        triggerBrowserDownload(`${backendOrigin}${currentSavedAsset.downloadUrl}`);
      }
      return;
    }

    if (!generation.videoUrl || !successStatuses.has(generation.status)) {
      setSaveState({
        isSaving: false,
        error: "Video belum siap disimpan.",
      });
      return;
    }

    setSaveState({
      isSaving: true,
      error: null,
    });

    try {
      const response = await fetch(`${backendBaseUrl}/assets/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: generation.taskId,
          prompt: generation.promptSnapshot,
          model: generation.model,
          aspectRatio: generation.aspectRatio,
          duration: generation.duration,
          videoUrl: generation.videoUrl,
          sourceKind: generation.sourceKind,
          sourceImageUrl: generation.sourceImageUrl,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        asset?: AssetRecord;
      };

      if (!response.ok || !payload.asset) {
        throw new Error(payload.error ?? "Asset tidak bisa disimpan.");
      }

      setAssets((current) => [
        payload.asset as AssetRecord,
        ...current.filter((item) => item.id !== payload.asset?.id),
      ]);
      setHealth((current) => ({
        ...current,
        storedAssets: current.storedAssets + (currentSavedAsset ? 0 : 1),
      }));
      setSaveState({
        isSaving: false,
        error: null,
      });

      if (downloadAfter) {
        triggerBrowserDownload(`${backendOrigin}${payload.asset.downloadUrl}`);
      }
    } catch (error) {
      setSaveState({
        isSaving: false,
        error:
          error instanceof Error ? error.message : "Asset tidak bisa disimpan.",
      });
    }
  }

  async function handleDeleteAsset(assetId: string) {
    try {
      const response = await fetch(`${backendBaseUrl}/assets/${assetId}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Asset tidak bisa dihapus.");
      }

      setAssets((current) => current.filter((asset) => asset.id !== assetId));
      setHealth((current) => ({
        ...current,
        storedAssets: Math.max(current.storedAssets - 1, 0),
      }));
    } catch (error) {
      setSaveState({
        isSaving: false,
        error:
          error instanceof Error ? error.message : "Asset tidak bisa dihapus.",
      });
    }
  }

  const handleLogin = () => {
    if (apiKey.trim()) {
      localStorage.setItem("freepik_api_key", apiKey);
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("freepik_api_key");
    setApiKey("");
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#05070a] flex items-center justify-center p-6 font-sans">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-orange-500/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-mint-500/10 blur-[120px] rounded-full animate-pulse delay-700" />
        </div>

        <div className="relative w-full max-w-md bg-[#0d1017]/80 backdrop-blur-xl border border-white/10 p-10 rounded-[32px] shadow-2xl reveal">
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-orange-300 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-orange-500/20">
              <Sparkles size={32} className="text-[#1a120b]" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white mb-3">Welcome to Studio</h1>
            <p className="text-slate-400 leading-relaxed">
              Input your Freepik API Key to unlock premium video generation features.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Freepik API Key</label>
              <div className="relative">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API Key..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={!apiKey.trim()}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-400 hover:to-orange-300 text-[#1a120b] font-bold py-4 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-xl shadow-orange-500/10 flex items-center justify-center gap-2"
            >
              Get Started
              <ArrowDownToLine size={20} className="rotate-[270deg]" />
            </button>
          </div>

          <p className="mt-8 text-center text-xs text-slate-500">
            Your key is stored locally in your browser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-app">
      <aside className="video-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand__mark">
            <Sparkles size={18} />
          </div>
          <div className="sidebar-brand__copy">
            <span className="sidebar-label">Workspace</span>
            <strong>Video</strong>
          </div>
        </div>

        <button className="sidebar-item is-active" type="button">
          <Clapperboard size={18} />
          <span>Video Studio</span>
        </button>

        <div className="sidebar-meta">
          <span className="sidebar-label">Assets</span>
          <strong>{health.storedAssets}</strong>
        </div>

        <button 
          onClick={() => setShowApiSettings(true)}
          className="sidebar-item mt-auto border-white/5 hover:bg-white/5" 
          type="button"
        >
          <SlidersHorizontal size={18} />
          <span>Settings</span>
        </button>

        <button 
          onClick={handleLogout}
          className="sidebar-item mt-2 border-white/5 hover:bg-red-500/10 hover:text-red-400" 
          type="button"
        >
          <Trash2 size={18} />
          <span>Logout</span>
        </button>
      </aside>

      <main className="video-main">
        <header className="app-header reveal">
          <div>
            <p className="eyebrow">Freepik Video Suite</p>
            <h1>Generate, simpan, dan download video dalam satu studio.</h1>
            <p className="header-copy">
              UI ini dirapikan ulang agar lebih fokus ke alur video: tulis prompt,
              upload referensi, pantau task, lalu simpan hasil ke folder project.
            </p>
          </div>

          <div className="header-actions">
            <div
              className={`status-pill status-pill--${
                health.online ? "success" : "danger"
              }`}
            >
              {health.online ? (
                <BadgeCheck size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span>
                {health.online
                  ? health.freepikConfigured 
                    ? "Freepik connected" 
                    : "Backend Online (Ready)"
                  : health.message ?? "Backend offline"}
              </span>
            </div>

            <button
              className="button-ghost"
              onClick={() => void Promise.all([refreshHealth(), loadAssets()])}
              type="button"
            >
              <RefreshCcw size={16} />
              Refresh studio
            </button>
          </div>
        </header>

        <section className="studio-band reveal delay-1">
          <div className="stage-shell">
            <div className="stage-screen" style={stageGlow}>
              <div className="stage-backdrop" />

              <div className="stage-topbar">
                <div className={`status-pill status-pill--${stageTone}`}>
                  {stageTone === "progress" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : stageTone === "success" ? (
                    <CheckCircle2 size={16} />
                  ) : stageTone === "danger" ? (
                    <AlertCircle size={16} />
                  ) : (
                    <Film size={16} />
                  )}
                  <span>{generation.status}</span>
                </div>

                {generation.taskId ? (
                  <div className="task-pill">
                    <Clock3 size={15} />
                    <strong>{generation.taskId}</strong>
                  </div>
                ) : null}
              </div>

              {currentPlaybackUrl ? (
                <video
                  autoPlay
                  className="stage-video"
                  controls
                  loop
                  muted={currentSavedAsset ? false : !form.generateAudio}
                  src={currentPlaybackUrl}
                />
              ) : (
                <div className="stage-placeholder">
                  <div className="stage-placeholder__copy">
                    <span className="eyebrow">Live canvas</span>
                    <h2>{generation.status === "ERROR" ? "Generation Error" : selectedModel.name}</h2>
                    <p>
                      {generation.error || (generation.status === "ERROR" 
                        ? "Terjadi kesalahan saat memproses atau memeriksa status video." 
                        : "Preview besar ini akan menampilkan hasil render aktif. Saat task selesai, Anda bisa simpan ke library lokal dan download langsung lewat tombol aksi.")}
                    </p>
                  </div>

                  <div className="stage-metrics">
                    <div>
                      <span>Ratio</span>
                      <strong>{form.aspectRatio}</strong>
                    </div>
                    <div>
                      <span>Duration</span>
                      <strong>{form.duration}s</strong>
                    </div>
                    <div>
                      <span>Source</span>
                      <strong>{getSourceKind(uploadedStartImage, form.startImageUrl)}</strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="stage-caption">
                <div className="stage-caption__icon">
                  <WandSparkles size={18} />
                </div>
                <div>
                  <span>Prompt focus</span>
                  <strong>
                    {(generation.promptSnapshot || deferredPrompt || "Tulis prompt untuk memulai render.").slice(
                      0,
                      160
                    )}
                  </strong>
                </div>
              </div>
            </div>

            <div className="stage-actions">
              <button
                className="button-ghost"
                disabled={!generation.taskId || isSubmitting}
                onClick={() => void handleRefreshCurrentTask()}
                type="button"
              >
                <RefreshCcw size={16} />
                Refresh status
              </button>

              <button
                className="button-ghost"
                disabled={!canSaveCurrentAsset || saveState.isSaving}
                onClick={() => void saveCurrentAsset(false)}
                type="button"
              >
                {saveState.isSaving ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                Simpan ke asset library
              </button>

              <button
                className="button-primary"
                disabled={
                  (!canSaveCurrentAsset && !currentSavedAsset) || saveState.isSaving
                }
                onClick={() => void saveCurrentAsset(true)}
                type="button"
              >
                <ArrowDownToLine size={16} />
                Download video
              </button>
            </div>
          </div>

          <div className="control-shell">
            <section className="tool-panel prompt-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Prompt</p>
                  <h3>Direction</h3>
                </div>
                <SlidersHorizontal size={18} />
              </div>

              <textarea
                className="prompt-input"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    prompt: event.target.value,
                  }))
                }
                placeholder="Describe the scene, motion, lighting, and subject..."
                rows={7}
                value={form.prompt}
              />

              <div className="preset-grid">
                {promptPresets.map((preset) => (
                  <button
                    key={preset}
                    className="preset-chip"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        prompt: preset,
                      }))
                    }
                    type="button"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="generate-row">
                <div className="generate-row__meta">
                  <span className="eyebrow">Ready</span>
                  <strong>{selectedModel.name}</strong>
                </div>

                <button
                  className="button-primary button-primary--wide"
                  disabled={isSubmitting || (!health.freepikConfigured && !apiKey.trim())}
                  onClick={() => void handleGenerate()}
                  type="button"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="spin" size={18} />
                      Generating
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Generate video
                    </>
                  )}
                </button>
              </div>
            </section>

            <section className="tool-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Model</p>
                  <h3>Video engine</h3>
                </div>
                <Clapperboard size={18} />
              </div>

              <div className="model-grid">
                {modelCatalog.map((model) => (
                  <button
                    key={model.id}
                    className={`model-option${
                      form.model === model.id ? " is-active" : ""
                    }`}
                    onClick={() => void handleModelChange(model.id)}
                    type="button"
                  >
                    <div className="model-option__header">
                      <strong>{model.name}</strong>
                      <span>{model.badge}</span>
                    </div>
                    <p>{model.description}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="tool-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Input</p>
                  <h3>Reference image</h3>
                </div>
                <ImagePlus size={18} />
              </div>

              <input
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleSourceImageUpload}
                ref={startImageInputRef}
                type="file"
              />

              <button
                className={`dropzone${isDraggingUpload ? " is-dragging" : ""}`}
                onClick={openSourcePicker}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDraggingUpload(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDraggingUpload(false);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDraggingUpload(true);
                }}
                onDrop={(event) => void handleDropUpload(event)}
                type="button"
              >
                {uploadedStartImage ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt="Uploaded source preview"
                      className="dropzone__image"
                      src={uploadedStartImage.dataUrl}
                    />
                    <div className="dropzone__body">
                      <strong>{uploadedStartImage.name}</strong>
                      <span>{uploadedStartImage.sizeLabel}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload size={26} />
                    <div className="dropzone__body">
                      <strong>Upload atau drag gambar</strong>
                      <span>PNG, JPG, WEBP sampai 10MB</span>
                    </div>
                  </>
                )}
              </button>

              {uploadedStartImage ? (
                <div className="inline-actions">
                  <span className="inline-tag">Local upload active</span>
                  <button className="button-ghost" onClick={clearUploadedImage} type="button">
                    <Trash2 size={16} />
                    Hapus image
                  </button>
                </div>
              ) : null}

              <label className="field">
                <span>Start image URL</span>
                <input
                  className="text-input"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      startImageUrl: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  type="url"
                  value={form.startImageUrl}
                />
              </label>

              <label className="field">
                <span>End image URL</span>
                <input
                  className="text-input"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      endImageUrl: event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  type="url"
                  value={form.endImageUrl}
                />
              </label>

              <p className="panel-note">
                Upload lokal otomatis berpindah ke model <strong>Runway 4.5 Image</strong>.
                Jika ingin prompt-only atau URL-only, pilih model lain secara manual.
              </p>
            </section>

            <section className="tool-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Output</p>
                  <h3>Render settings</h3>
                </div>
                <Volume2 size={18} />
              </div>

              <div className="choice-group">
                <span>Aspect ratio</span>
                <div className="choice-row">
                  {aspectRatioOptions.map((ratio) => (
                    <button
                      key={ratio}
                      className={`choice-chip${
                        form.aspectRatio === ratio ? " is-active" : ""
                      }`}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          aspectRatio: ratio,
                        }))
                      }
                      type="button"
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <div className="choice-group">
                <span>Duration</span>
                <div className="choice-row">
                  {durationOptions.map((duration) => (
                    <button
                      key={duration}
                      className={`choice-chip${
                        form.duration === duration ? " is-active" : ""
                      }`}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          duration,
                        }))
                      }
                      type="button"
                    >
                      {duration}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="choice-group mt-8 pt-8 border-t border-white/5">
                <MotionControlForm
                  uploadedVideoReference={uploadedVideoReference}
                  videoReferenceUrl={form.videoReferenceUrl}
                  referenceMode={form.referenceMode}
                  characterOrientation={form.characterOrientation}
                  motionStrength={form.motionStrength}
                  model={form.model}
                  onVideoUpload={handleVideoFile}
                  onVideoClear={() => {
                    setUploadedVideoReference(null);
                    setUploadError(null);
                  }}
                  onFormChange={(updates) =>
                    setForm((current) => ({
                      ...current,
                      ...updates,
                    }))
                  }
                  uploadError={uploadError}
                />
              </div>
              <div className="choice-group">
                <span>Camera control</span>
                <div className="choice-row">
                  {cameraControlOptions.map((opt) => (
                    <button
                      key={opt.id}
                      className={`px-3 py-2 rounded-xl border text-sm transition-all ${
                        form.cameraControl === opt.id
                          ? "bg-orange-500/20 border-orange-500 text-orange-200"
                          : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20"
                      }`}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          cameraControl: opt.id,
                        }))
                      }
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="toggle-row">
                <div>
                  <span>Generate audio</span>
                  <small>
                    {form.model === "runway-4-5-i2v"
                      ? "Nonaktif di mode Runway image-to-video."
                      : "Aktifkan jika ingin audio native dari model."}
                  </small>
                </div>
                <button
                  className={`toggle${
                    form.generateAudio && form.model !== "runway-4-5-i2v"
                      ? " is-on"
                      : ""
                  }`}
                  disabled={form.model === "runway-4-5-i2v"}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      generateAudio: !current.generateAudio,
                    }))
                  }
                  type="button"
                >
                  <span />
                </button>
              </div>

              <label className="field">
                <span>Negative prompt</span>
                <textarea
                  className="text-area"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      negativePrompt: event.target.value,
                    }))
                  }
                  rows={4}
                  value={form.negativePrompt}
                />
              </label>

              <label className="field">
                <span>CFG scale: {form.cfgScale.toFixed(1)}</span>
                <input
                  className="range-input"
                  max="1"
                  min="0"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cfgScale: Number(event.target.value),
                    }))
                  }
                  step="0.1"
                  type="range"
                  value={form.cfgScale}
                />
              </label>
            </section>
          </div>
        </section>

        {(generation.error || uploadError || saveState.error) && (
          <div className="message-strip reveal delay-2">
            {generation.error ? (
              <div className="inline-alert">
                <AlertCircle size={16} />
                <span>{generation.error}</span>
              </div>
            ) : null}

            {uploadError ? (
              <div className="inline-alert">
                <AlertCircle size={16} />
                <span>{uploadError}</span>
              </div>
            ) : null}

            {saveState.error ? (
              <div className="inline-alert">
                <AlertCircle size={16} />
                <span>{saveState.error}</span>
              </div>
            ) : null}
          </div>
        )}

        <section className="library-band reveal delay-2">
          <div className="library-header">
            <div>
              <p className="eyebrow">Remote Tasks</p>
              <h3>Recent tasks on Freepik for {selectedModel.name}</h3>
            </div>
            <button className="button-ghost" onClick={() => void loadRemoteTasks()} type="button">
              <RefreshCcw className={isLoadingRemoteTasks ? "spin" : ""} size={16} />
              Refresh tasks
            </button>
          </div>

          {isLoadingRemoteTasks ? (
            <div className="library-empty">
              <LoaderCircle className="spin" size={32} />
              <p>Fetching tasks from Freepik...</p>
            </div>
          ) : remoteTasks.length > 0 ? (
            <div className="asset-grid">
              {remoteTasks.map((task) => {
                const videoUrl = extractGeneratedUrl(task);
                const status = task.status || "UNKNOWN";
                const tone = getStatusTone(status);
                
                return (
                  <div key={task.id || task.task_id} className="asset-card">
                    <div className="asset-card__preview">
                      {videoUrl ? (
                        <video src={videoUrl} muted playsInline onMouseOver={(e) => e.currentTarget.play()} onMouseOut={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-white/5 text-slate-500">
                           <Clock3 size={32} className={tone === "progress" ? "animate-pulse" : ""} />
                           <span className="text-[10px] mt-2 uppercase font-bold">{status}</span>
                        </div>
                      )}
                    </div>
                    <div className="asset-card__body">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`status-tag status-tag--${tone}`}>{status}</span>
                        <small className="text-slate-500 text-[10px] font-mono">{task.id?.slice(0, 8) || task.task_id?.slice(0, 8)}</small>
                      </div>
                      <p className="text-xs text-white line-clamp-2 mb-3">{task.prompt || "No prompt provided"}</p>
                      
                      {videoUrl && (
                        <div className="flex gap-2">
                          <button 
                            className="button-primary button-primary--small flex-1"
                            onClick={() => {
                              setGeneration({
                                taskId: task.id || task.task_id,
                                model: form.model,
                                status: status,
                                videoUrl: videoUrl,
                                error: null,
                                promptSnapshot: task.prompt || "",
                                aspectRatio: task.aspect_ratio || "16:9",
                                duration: task.duration || "5",
                                sourceKind: "Remote Task",
                                sourceImageUrl: "",
                              });
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            <FolderOpen size={14} />
                            View
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="library-empty">
              <Film size={32} />
              <p>No recent tasks found for this model on Freepik.</p>
            </div>
          )}
        </section>

        <section className="library-band reveal delay-3">
          <div className="library-header">
            <div>
              <p className="eyebrow">Asset library</p>
              <h3>Video yang sudah tersimpan di folder project</h3>
            </div>

            <div className="library-header__meta">
              <div className="status-pill status-pill--neutral">
                <FolderOpen size={16} />
                <span>{assets.length} asset</span>
              </div>
              <button className="button-ghost" onClick={() => void loadAssets()} type="button">
                <RefreshCcw size={16} />
                Refresh library
              </button>
            </div>
          </div>

          {isLoadingAssets ? (
            <div className="empty-library">
              <LoaderCircle className="spin" size={18} />
              Memuat asset yang tersimpan...
            </div>
          ) : assets.length === 0 ? (
            <div className="empty-library">
              <Film size={18} />
              Belum ada video yang disimpan. Setelah render selesai, klik
              <strong> Simpan ke asset library</strong>.
            </div>
          ) : (
            <div className="asset-grid">
              {assets.map((asset) => (
                <article key={asset.id} className="asset-card">
                  <div className="asset-card__media">
                    <video
                      className="asset-card__video"
                      controls
                      preload="metadata"
                      src={`${backendOrigin}${asset.streamUrl}`}
                    />
                  </div>

                  <div className="asset-card__content">
                    <div className="asset-card__header">
                      <div>
                        <h4>{asset.title}</h4>
                        <p>{asset.prompt}</p>
                      </div>
                      <span className="asset-tag">{asset.model}</span>
                    </div>

                    <div className="asset-card__meta">
                      <span>{asset.aspectRatio}</span>
                      <span>{asset.duration}s</span>
                      <span>{asset.sourceKind}</span>
                      <span>{formatBytes(asset.sizeBytes)}</span>
                      <span>{formatRelativeTime(asset.savedAt)}</span>
                    </div>

                    <div className="asset-card__actions">
                      <button
                        className="button-ghost"
                        onClick={() =>
                          triggerBrowserDownload(
                            `${backendOrigin}${asset.downloadUrl}`
                          )
                        }
                        type="button"
                      >
                        <Download size={16} />
                        Download
                      </button>

                      <button
                        className="button-ghost"
                        onClick={() => void handleDeleteAsset(asset.id)}
                        type="button"
                      >
                        <Trash2 size={16} />
                        Hapus
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <ApiSettingsModal 
        isOpen={showApiSettings} 
        onClose={() => setShowApiSettings(false)} 
        apiKey={apiKey} 
        setApiKey={setApiKey} 
      />
    </div>
  );
}

function ApiSettingsModal({ isOpen, onClose, apiKey, setApiKey }: { isOpen: boolean, onClose: () => void, apiKey: string, setApiKey: (k: string) => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#0d1017] border border-white/10 w-full max-w-md rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Studio Settings</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400">
            <Trash2 size={20} className="rotate-45" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400 ml-1">Freepik API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                localStorage.setItem("freepik_api_key", e.target.value);
              }}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-orange-500/50 transition-all"
              placeholder="Your Freepik API Key..."
            />
            <p className="text-[11px] text-slate-500 ml-1">
              Changes are saved instantly to your browser storage.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-4 rounded-2xl transition-all"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
}
