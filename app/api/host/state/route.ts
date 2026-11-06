import { NextResponse, type NextRequest } from "next/server";
import { buildHostView } from "@/lib/live/view";
import { apiError } from "@/lib/server/api";
import { readGameState } from "@/lib/server/game-store";
import {
  findPlayerByToken,
  playerTokenFromRequest,
  requireHost,
} from "@/lib/server/request-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    requireHost(request);
    const state = await readGameState();
    const player = findPlayerByToken(state, playerTokenFromRequest(request));
    return NextResponse.json({
      view: buildHostView(state, player?.id ?? null),
    });
  } catch (error) {
    return apiError(error);
  }
}
