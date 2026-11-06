import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  addTeam,
  movePlayerToTeam,
  setTeamCapacity,
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

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("capacity"),
    teamId: z.string().min(1),
    capacity: z.number().int().min(1).max(50),
  }),
  z.object({ action: z.literal("add") }),
  z.object({
    action: z.literal("move-player"),
    playerId: z.string().min(1),
    teamId: z.string().min(1),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    const actor = requireHost(request);
    const body = schema.parse(await request.json());
    const token = playerTokenFromRequest(request);

    const view = await mutateGameState((draft) => {
      if (body.action === "capacity") {
        setTeamCapacity(draft, body.teamId, body.capacity, actor);
      } else if (body.action === "add") {
        addTeam(draft, actor);
      } else {
        movePlayerToTeam(draft, body.playerId, body.teamId, actor);
      }
      const player = findPlayerByToken(draft, token);
      return buildHostView(draft, player?.id ?? null);
    });

    return NextResponse.json({ view });
  } catch (error) {
    return apiError(error);
  }
}
