import { NextResponse } from "next/server";
import { getGameStoreInfo } from "@/lib/server/game-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "nomikai-app",
    now: new Date().toISOString(),
    region: process.env.VERCEL_REGION ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    store: await getGameStoreInfo(),
  });
}
