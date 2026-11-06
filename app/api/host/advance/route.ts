import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  applyHostAction,
  extendFinalCheck,
  type HostAction,
} from "@/lib/live/engine";
import { buildHostView } from "@/lib/live/view";
import { apiError } from "@/lib/server/api";
import { mutateGameState } from "@/lib/server/game-store";
import {
  findPlayerByToken,
  playerTokenFromRequest,
  requireHost,
} from "@/lib/server/request-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  action: z.enum([
    "start",
    "close",
    "reveal",
    "grouping",
    "score",
    "next",
    "finish",
    "reset",
    "reset-all",
    "extend",
  ]),
  expectedPhase: z.string().optional(),
  deltaSeconds: z.number().int().min(-120).max(180).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const actor = requireHost(request);
    const body = schema.parse(await request.json());
    const playerToken = playerTokenFromRequest(request);

    const view = await mutateGameState((draft) => {
      if (body.action === "extend") {
        extendFinalCheck(draft, body.deltaSeconds ?? 30, actor);
      } else {
        applyHostAction(
          draft,
          body.action as HostAction,
          actor,
          body.expectedPhase,
        );
      }
      const player = findPlayerByToken(draft, playerToken);
      return buildHostView(draft, player?.id ?? null);
    });

    return NextResponse.json({ view });
  } catch (error) {
    return apiError(error);
  }
}
