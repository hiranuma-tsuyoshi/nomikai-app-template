import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { GameState, LivePlayer } from "@/lib/live/types";

export const PLAYER_COOKIE = "nomikai_player";
export const HOST_COOKIE = "nomikai_host";
export const PLAYER_COOKIE_MAX_AGE = 60 * 60 * 12;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createPlayerToken(): string {
  return `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
}

export function playerTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(PLAYER_COOKIE)?.value ?? null;
}

export function findPlayerByToken(
  state: GameState,
  token: string | null,
): LivePlayer | null {
  if (!token) return null;
  const tokenHash = hashToken(token);
  return state.players.find((player) => player.tokenHash === tokenHash) ?? null;
}

export function setPlayerCookie(response: NextResponse, token: string): void {
  response.cookies.set(PLAYER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PLAYER_COOKIE_MAX_AGE,
    path: "/",
  });
}

export function getHostKey(): string {
  return process.env.HOST_KEY ?? "4821";
}

export function isHostKeyValid(candidate: string | null): boolean {
  if (!candidate) return false;
  const expected = getHostKey();
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function requireHost(request: NextRequest): string {
  const candidate =
    request.headers.get("x-host-key") ??
    request.nextUrl.searchParams.get("key") ??
    request.cookies.get(HOST_COOKIE)?.value ??
    null;

  if (!isHostKeyValid(candidate)) {
    const error = new Error("司会者キーが必要です") as Error & {
      code: string;
      status: number;
    };
    error.code = "HOST_UNAUTHORIZED";
    error.status = 401;
    throw error;
  }

  const actor = request.headers.get("x-host-actor")?.trim();
  return actor ? actor.slice(0, 30) : "運営";
}

export function setHostCookie(response: NextResponse): void {
  response.cookies.set(HOST_COOKIE, getHostKey(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PLAYER_COOKIE_MAX_AGE,
    path: "/",
  });
}
