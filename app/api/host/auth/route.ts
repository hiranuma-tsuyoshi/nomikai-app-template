import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/server/api";
import {
  isHostKeyValid,
  setHostCookie,
} from "@/lib/server/request-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ key: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const { key } = schema.parse(await request.json());
    if (!isHostKeyValid(key)) {
      return NextResponse.json(
        { error: "司会者キーが違います", code: "HOST_UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true });
    setHostCookie(response);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
