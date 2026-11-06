import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { submitAnswer } from "@/lib/live/engine";
import { buildParticipantView } from "@/lib/live/view";
import { apiError } from "@/lib/server/api";
import { mutateGameState } from "@/lib/server/game-store";
import {
  findPlayerByToken,
  playerTokenFromRequest,
} from "@/lib/server/request-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const answerSchema = z.object({
  text: z.string().min(1).max(20),
});

export async function POST(request: NextRequest) {
  try {
    const token = playerTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: "参加登録が必要です", code: "NEEDS_JOIN" },
        { status: 401 },
      );
    }

    const body = answerSchema.parse(await request.json());
    const view = await mutateGameState((draft) => {
      const player = findPlayerByToken(draft, token);
      if (!player) {
        const error = new Error("参加登録が必要です") as Error & {
          code: string;
          status: number;
        };
        error.code = "NEEDS_JOIN";
        error.status = 401;
        throw error;
      }
      submitAnswer(draft, player.id, body.text);
      return buildParticipantView(draft, player.id);
    });

    return NextResponse.json({ view });
  } catch (error) {
    return apiError(error);
  }
}
