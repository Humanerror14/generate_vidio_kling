import { NextResponse } from "next/server";
import {
  readAssetRecords,
  defaultModel,
  modelRegistry,
} from "@/lib/backend";

export async function GET() {
  try {
    const assets = await readAssetRecords();
    return NextResponse.json({
      ok: true,
      freepikConfigured: Boolean(process.env.FREEPIK_API_KEY),
      userKeySupported: true,
      defaultModel,
      availableModels: Object.keys(modelRegistry),
      storedAssets: assets.length,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Health check failed" },
      { status: 500 }
    );
  }
}
