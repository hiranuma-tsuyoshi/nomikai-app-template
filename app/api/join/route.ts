import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { joinState } from "@/lib/live/engine";
import { buildParticipantView, buildPublicRoomView } from "@/lib/live/view";
import { apiError } from "@/lib/server/api";
import { mutateGameState, readGameState } from "@/lib/server/game-store";
import {
  createPlayerToken,
  hashToken,
  setPlayerCookie,
} from "@/lib/server/request-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const joinSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1).max(20),
  teamId: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = joinSchema.parse(await request.json());
    const state = await readGameState();

    if (body.code !== state.room.code) {
      return NextResponse.json(
        {
          error: "ルームコードが違います",
          code: "ROOM_NOT_FOUND",
          room: buildPublicRoomView(state),
        },
        { status: 404 },
      );
    }

    const token = createPlayerToken();
    const view = await mutateGameState((draft) => {
      const player = joinState(
        draft,
        { name: body.name, teamId: body.teamId },
        hashToken(token),
      );
      return buildParticipantView(draft, player.id);
    });

    const response = NextResponse.json({ view }, { status: 201 });
    setPlayerCookie(response, token);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
