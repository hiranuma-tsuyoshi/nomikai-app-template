import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { replaceQuestions } from "@/lib/live/engine";
import { apiError } from "@/lib/server/api";
import { mutateGameState, readGameState } from "@/lib/server/game-store";
import { requireHost } from "@/lib/server/request-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const questionSchema = z.object({
  id: z.string().min(1).optional(),
  text: z.string().min(1).max(100),
  timeLimitSeconds: z.number().int().min(10).max(600),
});

const saveSchema = z.object({
  questions: z.array(questionSchema).max(50),
});

export async function GET(request: NextRequest) {
  try {
    requireHost(request);
    const state = await readGameState();
    return NextResponse.json({
      questions: [...state.questions].sort(
        (a, b) => a.orderIndex - b.orderIndex,
      ),
      frozen: state.questionsFrozen,
      phase: state.room.phase,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = requireHost(request);
    const body = saveSchema.parse(await request.json());
    const questions = await mutateGameState((draft) => {
      replaceQuestions(draft, body.questions, actor);
      return [...draft.questions].sort((a, b) => a.orderIndex - b.orderIndex);
    });

    return NextResponse.json({ questions, frozen: false });
  } catch (error) {
    return apiError(error);
  }
}
