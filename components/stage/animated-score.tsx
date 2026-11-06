"use client";

import { useEffect, useState } from "react";

type AnimatedScoreProps = {
  value: number;
  delay?: number;
  duration?: number;
};

/**
 * 得点を0からカウントアップする。
 * 読み上げ用には最終値だけを別途提供し、途中の数字はaria-hiddenにする。
 */
export function AnimatedScore({
  value,
  delay = 0,
  duration = 700,
}: AnimatedScoreProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    let startedAt: number | null = null;
    const timer = window.setTimeout(() => {
      frame = window.requestAnimationFrame(function tick(now) {
        if (startedAt === null) startedAt = now;
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);

        setDisplay(Math.round(value * eased));

        if (progress < 1) {
          frame = window.requestAnimationFrame(tick);
        }
      });
    }, delay);

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
  }, [delay, duration, value]);

  return (
    <>
      <span aria-hidden="true">{display}</span>
      <span className="sr-only">{value}</span>
    </>
  );
}

type ConsistencyBarProps = {
  rate: number;
  isPerfect: boolean;
  delay?: number;
};

export function ConsistencyBar({
  rate,
  isPerfect,
  delay = 0,
}: ConsistencyBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      setWidth(rate * 100);
      return;
    }

    const timer = window.setTimeout(() => setWidth(rate * 100), delay);
    return () => window.clearTimeout(timer);
  }, [delay, rate]);

  return (
    <div
      className={`h-[clamp(8px,0.9vh,14px)] overflow-hidden rounded-full ${
        isPerfect ? "bg-stage-bg/20" : "bg-white/10"
      }`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${
          isPerfect ? "bg-stage-bg" : "bg-stage-green"
        }`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
