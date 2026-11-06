import { NextResponse } from "next/server";
import { readGameState } from "@/lib/server/game-store";
import { buildPublicRoomView } from "@/lib/live/view";
import { apiError } from "@/lib/server/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const state = await readGameState();
    return NextResponse.json({ room: buildPublicRoomView(state) });
  } catch (error) {
    return apiError(error);
  }
}
