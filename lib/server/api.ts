import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { GameError } from "@/lib/live/engine";

type ErrorWithCode = Error & { code?: string; status?: number };

export function apiError(error: unknown): NextResponse {
  if (error instanceof GameError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "入力内容を確認してください",
        code: "VALIDATION_ERROR",
        details: error.issues.map((issue) => issue.message),
      },
      { status: 422 },
    );
  }

  const known = error as ErrorWithCode;
  if (known?.code === "HOST_UNAUTHORIZED") {
    return NextResponse.json(
      { error: known.message, code: known.code },
      { status: 401 },
    );
  }

  console.error("[api]", error);
  return NextResponse.json(
    { error: "サーバーでエラーが発生しました", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
