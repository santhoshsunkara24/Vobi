import { useLayoutEffect, useRef, useState } from "react";

export interface ThumbStyle {
  transform: string;
  width?: number;
  height?: number;
  /** Off for the first placement, so the thumb doesn't slide in from 0. */
  transition?: string;
  opacity?: number;
}

/**
 * Places a sliding highlight under the active child of a container. The
 * active child is the one marked `aria-current="page"` or
 * `aria-pressed="true"`. `axis` picks vertical (nav) or horizontal (segments).
 */
export function useSlidingThumb<T extends HTMLElement>(
  activeKey: string | number | null,
  axis: "x" | "y",
) {
  const ref = useRef<T>(null);
  const placed = useRef(false);
  const [style, setStyle] = useState<ThumbStyle>({
    transform: "none",
    opacity: 0,
  });

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>(
        '[aria-current="page"], [aria-pressed="true"]',
      );
      if (!active) {
        setStyle({ transform: "none", opacity: 0 });
        return;
      }
      const first = !placed.current;
      placed.current = true;
      setStyle(
        axis === "y"
          ? {
              transform: `translateY(${active.offsetTop}px)`,
              height: active.offsetHeight,
              transition: first ? "none" : undefined,
            }
          : {
              transform: `translateX(${active.offsetLeft}px)`,
              width: active.offsetWidth,
              transition: first ? "none" : undefined,
            },
      );
    };
    measure();
    // Labels change width with the UI language and fonts load late.
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [activeKey, axis]);

  return { ref, style };
}
