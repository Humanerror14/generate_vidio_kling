import { NextResponse } from "next/server";
import { defaultModel, modelRegistry } from "@/lib/backend";

// Simplified health check — no filesystem ops to avoid cold-start failures
export async function GET() {
  return NextResponse.json({
    ok: true,
    freepikConfigured: Boolean(process.env.FREEPIK_API_KEY),
    userKeySupported: true,
    defaultModel,
    availableModels: Object.keys(modelRegistry),
    storedAssets: 0,
  });
}
