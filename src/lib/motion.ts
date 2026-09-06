import { cubicInOut, cubicOut, quintOut } from "svelte/easing";

export type MotionParams = {
  delay?: number;
  duration?: number;
};

export type SurfaceMotionParams = MotionParams & {
  y?: number;
  scale?: number;
};

export type PanelMotionParams = MotionParams & {
  side?: "left" | "right";
  distance?: number;
};

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function duration(value: number): number {
  return reducedMotion() ? 0 : value;
}

export function backdropMotion(_node: Element, params: MotionParams = {}) {
  return {
    delay: reducedMotion() ? 0 : (params.delay ?? 0),
    duration: duration(params.duration ?? 150),
    easing: cubicOut,
    css: (t: number) => `opacity:${t}`,
  };
}

export function modalMotion(_node: Element, params: SurfaceMotionParams = {}) {
  const y = params.y ?? 10;
  const fromScale = params.scale ?? 0.985;
  const scaleDelta = 1 - fromScale;
  return {
    delay: reducedMotion() ? 0 : (params.delay ?? 0),
    duration: duration(params.duration ?? 205),
    easing: quintOut,
    css: (t: number) => {
      const inv = 1 - t;
      return `opacity:${t};transform:translate3d(0,${inv * y}px,0) scale(${1 - inv * scaleDelta})`;
    },
  };
}

export function paletteMotion(_node: Element, params: SurfaceMotionParams = {}) {
  const y = params.y ?? -7;
  const fromScale = params.scale ?? 0.992;
  const scaleDelta = 1 - fromScale;
  return {
    delay: reducedMotion() ? 0 : (params.delay ?? 0),
    duration: duration(params.duration ?? 175),
    easing: quintOut,
    css: (t: number) => {
      const inv = 1 - t;
      return `opacity:${t};transform:translate3d(0,${inv * y}px,0) scale(${1 - inv * scaleDelta})`;
    },
  };
}

export function popoverMotion(_node: Element, params: SurfaceMotionParams = {}) {
  const y = params.y ?? -5;
  const fromScale = params.scale ?? 0.985;
  const scaleDelta = 1 - fromScale;
  return {
    delay: reducedMotion() ? 0 : (params.delay ?? 0),
    duration: duration(params.duration ?? 135),
    easing: cubicOut,
    css: (t: number) => {
      const inv = 1 - t;
      return `opacity:${t};transform:translate3d(0,${inv * y}px,0) scale(${1 - inv * scaleDelta})`;
    },
  };
}

export function sidePanelMotion(node: Element, params: PanelMotionParams = {}) {
  const side = params.side ?? "left";
  const distance = params.distance ?? 14;
  const direction = side === "left" ? -1 : 1;
  const width = Math.max(1, node.getBoundingClientRect().width);
  return {
    delay: reducedMotion() ? 0 : (params.delay ?? 0),
    duration: duration(params.duration ?? 180),
    easing: cubicInOut,
    css: (t: number) => {
      const inv = 1 - t;
      return `max-width:${Math.max(0, t * width)}px;min-width:0;opacity:${0.72 + t * 0.28};transform:translate3d(${direction * inv * distance}px,0,0);overflow:hidden`;
    },
  };
}

export function primaryContentMotion(_node: Element, params: SurfaceMotionParams = {}) {
  const y = params.y ?? 2;
  return {
    delay: reducedMotion() ? 0 : (params.delay ?? 0),
    duration: duration(params.duration ?? 120),
    easing: cubicOut,
    // Primary document surfaces must never fade from transparent. In WKWebView,
    // opacity-based page transitions expose the backing view for a frame and read
    // as a white/dark flash. Keep the surface fully opaque and only settle it by
    // a couple of pixels.
    css: (t: number) => `opacity:1;transform:translate3d(0,${(1 - t) * y}px,0)`,
  };
}

export function contentMotion(_node: Element, params: SurfaceMotionParams = {}) {
  const y = params.y ?? 5;
  return {
    delay: reducedMotion() ? 0 : (params.delay ?? 0),
    duration: duration(params.duration ?? 180),
    easing: cubicOut,
    css: (t: number) => `opacity:${t};transform:translate3d(0,${(1 - t) * y}px,0)`,
  };
}

export function tabMotion(_node: Element, params: SurfaceMotionParams = {}) {
  const fromScale = params.scale ?? 0.97;
  const scaleDelta = 1 - fromScale;
  return {
    delay: reducedMotion() ? 0 : (params.delay ?? 0),
    duration: duration(params.duration ?? 140),
    easing: cubicOut,
    css: (t: number) => {
      const inv = 1 - t;
      return `opacity:${t};transform:scale(${1 - inv * scaleDelta});transform-origin:50% 100%`;
    },
  };
}

export function toastMotion(_node: Element, params: SurfaceMotionParams = {}) {
  const y = params.y ?? 8;
  return {
    delay: reducedMotion() ? 0 : (params.delay ?? 0),
    duration: duration(params.duration ?? 165),
    easing: quintOut,
    css: (t: number) => `opacity:${t};transform:translate3d(0,${(1 - t) * y}px,0) scale(${0.985 + t * 0.015})`,
  };
}
