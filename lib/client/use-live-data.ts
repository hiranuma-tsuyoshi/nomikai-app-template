"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ApiErrorBody = {
  error?: string;
  code?: string;
  details?: string[];
  room?: unknown;
  status?: number;
};

type PollingState<T> = {
  data: T | null;
  error: ApiErrorBody | null;
  loading: boolean;
  refresh: () => void;
};

/**
 * 1.5秒間隔のポーリング。前のリクエストが終わってから次を予約するので、
 * 遅い回線でもリクエストが重ならない。
 */
export function usePollingJson<T>(
  url: string,
  options?: {
    intervalMs?: number;
    enabled?: boolean;
    headers?: Record<string, string>;
  },
): PollingState<T> {
  const intervalMs = options?.intervalMs ?? 1500;
  const enabled = options?.enabled ?? true;
  const headersKey = JSON.stringify(options?.headers ?? {});
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiErrorBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const mountedRef = useRef(true);
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: number | null = null;
    let controller: AbortController | null = null;

    async function run() {
      controller = new AbortController();
      try {
        const response = await fetch(url, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
          headers: JSON.parse(headersKey) as Record<string, string>,
        });
        const body = (await response.json().catch(() => ({}))) as
          | T
          | ApiErrorBody;

        if (!response.ok) {
          if (!cancelled && mountedRef.current) {
            setError({ ...(body as ApiErrorBody), status: response.status });
            setLoading(false);
          }
          return;
        }

        if (!cancelled && mountedRef.current) {
          setData(body as T);
          setError(null);
          setLoading(false);
        }
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        if (!cancelled && mountedRef.current) {
          setError({
            error:
              "通信できませんでした。Wi-Fiを確認して、そのままお待ちください。",
            code: "NETWORK_ERROR",
          });
          setLoading(false);
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(run, intervalMs);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
      controller?.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [enabled, headersKey, intervalMs, tick, url]);

  return { data, error, loading, refresh };
}

export async function postJson<T>(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T &
    ApiErrorBody;

  if (!response.ok) {
    throw new ApiRequestError(
      payload.error ?? "通信に失敗しました",
      payload.code ?? "REQUEST_FAILED",
      response.status,
      payload,
    );
  }
  return payload;
}

export async function putJson<T>(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    cache: "no-store",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as T &
    ApiErrorBody;

  if (!response.ok) {
    throw new ApiRequestError(
      payload.error ?? "保存に失敗しました",
      payload.code ?? "REQUEST_FAILED",
      response.status,
      payload,
    );
  }
  return payload;
}

export class ApiRequestError extends Error {
  code: string;
  status: number;
  payload: ApiErrorBody;

  constructor(
    message: string,
    code: string,
    status: number,
    payload: ApiErrorBody,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.payload = payload;
  }
}
