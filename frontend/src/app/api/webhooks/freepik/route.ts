import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    console.log("Webhook received from Freepik:", {
      taskId: payload.task_id || payload.id,
      status: payload.status,
      timestamp: new Date().toISOString(),
    });

    // Acknowledge receipt
    return NextResponse.json({
      success: true,
      received: true,
      taskId: payload.task_id || payload.id,
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    // Always return 200/JSON to prevent Freepik retries for processing errors
    return NextResponse.json({
      success: false,
      error: (err as Error).message,
    });
  }
}
