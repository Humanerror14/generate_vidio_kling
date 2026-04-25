import { type NextRequest, NextResponse } from "next/server";
import { callFreepik, getModelConfig, defaultModel } from "@/lib/backend";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const { searchParams } = new URL(request.url);
    const model = String(searchParams.get("model") || defaultModel);
    const apiKey = searchParams.get("apiKey") || undefined;
    const selectedModel = getModelConfig(model);

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID wajib diisi." },
        { status: 400 }
      );
    }

    const result = await callFreepik(
      `${selectedModel.taskBasePath}/${encodeURIComponent(taskId)}`,
      { method: "GET" },
      apiKey
    );

    return NextResponse.json({
      success: true,
      model,
      data: result.data || result,
    });
  } catch (err) {
    const e = err as Error & { statusCode?: number; details?: unknown };
    return NextResponse.json(
      { error: e.message || "Terjadi kesalahan pada server.", details: e.details || null },
      { status: e.statusCode || 500 }
    );
  }
}
