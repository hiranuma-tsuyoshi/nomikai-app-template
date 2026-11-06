import { NextResponse, type NextRequest } from "next/server";
import { readGameState } from "@/lib/server/game-store";
import { buildParticipantView, buildPublicRoomView } from "@/lib/live/view";
import { apiError } from "@/lib/server/api";
import {
  findPlayerByToken,
  playerTokenFromRequest,
} from "@/lib/server/request-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const state = await readGameState();
    const player = findPlayerByToken(state, playerTokenFromRequest(request));
    if (!player) {
      return NextResponse.json(
        {
          error: "参加登録が必要です",
          code: "NEEDS_JOIN",
          room: buildPublicRoomView(state),
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      view: buildParticipantView(state, player.id),
    });
  } catch (error) {
    return apiError(error);
  }
}
