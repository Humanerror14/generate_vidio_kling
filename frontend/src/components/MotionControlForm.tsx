import React, { Dispatch, SetStateAction, useRef } from "react";
import {
  Film,
  Trash2,
  Upload,
  AlertCircle,
  Info,
} from "lucide-react";
import type {
  CharacterOrientation,
  ReferenceMode,
} from "@/lib/motion-control-api";

interface UploadedVideo {
  name: string;
  dataUrl: string;
  sizeLabel: string;
}

interface MotionControlFormProps {
  uploadedVideoReference: UploadedVideo | null;
  videoReferenceUrl: string;
  referenceMode: ReferenceMode;
  characterOrientation: CharacterOrientation;
  motionStrength: number;
  model: string;
  onVideoUpload: (file: File) => void;
  onVideoClear: () => void;
  onFormChange: (updates: Record<string, unknown>) => void;
  uploadError: string | null;
}

export function MotionControlForm({
  uploadedVideoReference,
  videoReferenceUrl,
  referenceMode,
  characterOrientation,
  motionStrength,
  model,
  onVideoUpload,
  onVideoClear,
  onFormChange,
  uploadError,
}: MotionControlFormProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      onVideoUpload(file);
    }
  };

  const handleVideoUploadClick = () => {
    videoInputRef.current?.click();
  };

  const isMotionControlModel = model.startsWith("kling-v3");

  return (
    <section className="tool-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Motion Control</p>
          <h3>Reference video settings</h3>
        </div>
        <Film size={18} className="text-orange-400" />
      </div>

      {/* Video Upload Section */}
      <div className="space-y-4">
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          ref={videoInputRef}
          onChange={handleVideoUpload}
        />

        <div
          onClick={!uploadedVideoReference ? handleVideoUploadClick : undefined}
          className={`w-full group relative overflow-hidden rounded-2xl border-2 border-dashed transition-all p-6 text-center ${
            uploadedVideoReference
              ? "border-orange-500/50 bg-orange-500/5"
              : "border-white/10 hover:border-white/20 bg-white/5 cursor-pointer"
          }`}
        >
          {uploadedVideoReference ? (
            <div className="flex flex-col w-full gap-3">
              <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-white/10">
                <video 
                  src={uploadedVideoReference.dataUrl} 
                  className="w-full h-full object-cover"
                  autoPlay 
                  muted 
                  loop 
                  playsInline
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onVideoClear();
                    }}
                    className="p-2 bg-black/60 hover:bg-red-500/80 backdrop-blur-md rounded-lg text-white transition-colors"
                    type="button"
                    title="Remove video"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 text-left">
                  <p className="text-xs font-bold text-white truncate">
                    {uploadedVideoReference.name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {uploadedVideoReference.sizeLabel}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload size={24} className="mx-auto text-slate-500 group-hover:text-orange-400 transition-colors" />
              <p className="text-sm font-medium text-slate-300">
                Upload Motion Reference
              </p>
              <p className="text-xs text-slate-500">MP4, MOV up to 20MB</p>
            </div>
          )}
        </div>

        {/* Video URL Input */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1">
            Or Video URL
          </label>
          <input
            type="url"
            value={videoReferenceUrl}
            onChange={(e) =>
              onFormChange({ videoReferenceUrl: e.target.value })
            }
            placeholder="https://..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500/40 transition-all placeholder:text-slate-600"
          />
        </div>

        {/* Reference Mode Selection */}
        <div className="space-y-3 pt-4">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1">
            Reference Mode
          </label>
          <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
            <button
              onClick={() =>
                onFormChange({ referenceMode: "motion" })
              }
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                referenceMode === "motion"
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
              type="button"
            >
              Motion
            </button>
            <button
              onClick={() =>
                onFormChange({ referenceMode: "appearance" })
              }
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                referenceMode === "appearance"
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
              type="button"
            >
              Style
            </button>
          </div>
          <div className="flex gap-2 items-start px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-300">
              {referenceMode === "motion"
                ? "Video will follow motion patterns from reference"
                : "Video will follow visual style/appearance from reference"}
            </p>
          </div>
        </div>

        {/* Character Orientation (Motion Control Pro Only) */}
        {isMotionControlModel && (
          <div className="space-y-3 pt-4 border-t border-white/5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1">
              Character Orientation
            </label>
            <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
              <button
                onClick={() =>
                  onFormChange({ characterOrientation: "video" })
                }
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  characterOrientation === "video"
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
                type="button"
              >
                Match Video
              </button>
              <button
                onClick={() =>
                  onFormChange({ characterOrientation: "image" })
                }
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  characterOrientation === "image"
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
                type="button"
              >
                Match Image
              </button>
            </div>
            <div className="flex gap-2 items-start px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <Info size={14} className="text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-purple-300">
                {characterOrientation === "video"
                  ? "Better for complex motion (up to 30 seconds)"
                  : "Better for camera movement (up to 10 seconds)"}
              </p>
            </div>
          </div>
        )}

        {/* Motion Strength Slider */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Motion Strength
            </label>
            <span className="text-orange-400 font-bold text-sm">
              {motionStrength}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={motionStrength}
            onChange={(e) =>
              onFormChange({ motionStrength: Number(e.target.value) })
            }
            className="w-full accent-orange-500"
          />
          <p className="text-[10px] text-slate-500">
            Higher values = more intense motion from reference
          </p>
        </div>
      </div>

      {/* Error Display */}
      {uploadError && (
        <div className="mt-4 flex gap-2 items-start p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-red-300">{uploadError}</p>
        </div>
      )}

      {/* Info */}
      <div className="mt-4 flex gap-2 items-start p-3 bg-slate-500/10 border border-slate-500/20 rounded-lg">
        <Info size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-400">
          Motion control requires both a character image and a reference video.
          Upload or provide URLs for both to enable motion transfer.
        </p>
      </div>
    </section>
  );
}
