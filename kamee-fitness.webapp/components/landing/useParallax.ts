"use client";

import { useEffect, useRef } from "react";
import { normalizePointer, prefersReducedMotion } from "@/lib/landing/parallax";

/**
 * Writes the page scroll offset (px) to `--scroll-y` on the ref'd element via a
 * rAF loop so background layers can drift slower than content. Inert under
 * reduced motion.
 */
export function useScrollParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let frame = 0;
    const update = () => {
      el.style.setProperty("--scroll-y", String(window.scrollY));
      frame = 0;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}

/**
 * Tracks the pointer within the ref'd element and writes normalized coords
 * (-1..1) to `--px` / `--py`, easing back to 0 on leave. No-op on touch devices
 * and under reduced motion.
 */
export function usePointerTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      el.style.setProperty("--px", x.toFixed(4));
      el.style.setProperty("--py", y.toFixed(4));
      frame = 0;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onMove = (e: PointerEvent) => {
      const p = normalizePointer(
        e.clientX,
        e.clientY,
        el.getBoundingClientRect(),
      );
      x = p.x;
      y = p.y;
      schedule();
    };
    const onLeave = () => {
      x = 0;
      y = 0;
      schedule();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}
