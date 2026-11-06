import { NextResponse, type NextRequest } from "next/server";
import { buildStageView } from "@/lib/live/view";
import { apiError } from "@/lib/server/api";
import { readGameState } from "@/lib/server/game-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const state = await readGameState();
    const token = request.nextUrl.searchParams.get("token");

    if (token && token !== state.room.screenToken) {
      return NextResponse.json(
        { error: "スクリーン用URLが正しくありません", code: "SCREEN_UNAUTHORIZED" },
        { status: 403 },
      );
    }
    if (process.env.STAGE_REQUIRE_TOKEN === "1" && !token) {
      return NextResponse.json(
        { error: "スクリーン用URLが必要です", code: "SCREEN_UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const joinUrl = new URL(
      `/play?code=${encodeURIComponent(state.room.code)}`,
      request.nextUrl.origin,
    ).toString();

    return NextResponse.json({ view: buildStageView(state, joinUrl) });
  } catch (error) {
    return apiError(error);
  }
}
