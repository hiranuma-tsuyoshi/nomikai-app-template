import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { mergeGroups, unmergeGroup } from "@/lib/live/engine";
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
    action: z.literal("merge"),
    teamId: z.string().min(1),
    keys: z.array(z.string().min(1)).min(2),
    label: z.string().min(1).max(20),
    reason: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal("unmerge"),
    groupId: z.string().min(1),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    const actor = requireHost(request);
    const body = schema.parse(await request.json());
    const playerToken = playerTokenFromRequest(request);

    const view = await mutateGameState((draft) => {
      if (body.action === "merge") {
        mergeGroups(draft, {
          teamId: body.teamId,
          keys: body.keys,
          label: body.label,
          reason: body.reason,
          actor,
        });
      } else {
        unmergeGroup(draft, body.groupId, actor);
      }
      const player = findPlayerByToken(draft, playerToken);
      return buildHostView(draft, player?.id ?? null);
    });

    return NextResponse.json({ view });
  } catch (error) {
    return apiError(error);
  }
}
