import React, { useEffect, useRef } from "react";
import { CloudEngine, type CloudState } from "./cloudEngine";

export type { CloudState };

interface VobiCloudProps {
  size: number;
  state?: CloudState;
  /** Voice loudness 0..1, used while listening. */
  level?: number;
  mono?: boolean;
  shadow?: boolean;
  /** Little legs (Vobi on screen). */
  legs?: boolean;
  /** Being dragged: the legs dangle and kick. */
  carried?: boolean;
  className?: string;
}

/** Vobi, the animated cloud. Purely decorative, so hidden from screen readers. */
export const VobiCloud: React.FC<VobiCloudProps> = ({
  size,
  state = "idle",
  level = 0,
  mono,
  shadow,
  legs,
  carried = false,
  className,
}) => {
  const mountRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<CloudEngine>();

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new CloudEngine(mountRef.current, {
      size,
      mono,
      shadow,
      legs,
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = undefined;
    };
  }, [size, mono, shadow, legs]);

  useEffect(() => {
    engineRef.current?.setState(state);
  }, [state, size, mono, shadow, legs]);

  useEffect(() => {
    engineRef.current?.setCarried(carried);
  }, [carried, size, mono, shadow, legs]);

  useEffect(() => {
    engineRef.current?.setLevel(level);
  }, [level]);

  return (
    <span
      ref={mountRef}
      className={className}
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        lineHeight: 0,
      }}
    />
  );
};

export default VobiCloud;
