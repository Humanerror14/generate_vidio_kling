import { type NextRequest, NextResponse } from "next/server";
import { callFreepik, getModelConfig, defaultModel } from "@/lib/backend";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const model = String(searchParams.get("model") || defaultModel);
    const apiKey = searchParams.get("apiKey") || undefined;
    const selectedModel = getModelConfig(model);

    let result;
    try {
      result = await callFreepik(
        selectedModel.taskBasePath,
        { method: "GET" },
        apiKey
      );
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      if (e.statusCode === 404) {
        return NextResponse.json({ success: true, model, data: [] });
      }
      throw err;
    }

    return NextResponse.json({
      success: true,
      model,
      data: result.data || result,
    });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return NextResponse.json(
      { error: e.message || "Terjadi kesalahan pada server." },
      { status: e.statusCode || 500 }
    );
  }
}
