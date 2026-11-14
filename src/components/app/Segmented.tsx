import React from "react";
import { useSlidingThumb } from "./useSlidingThumb";

export interface SegmentOption<V extends string> {
  value: V;
  label: React.ReactNode;
  disabled?: boolean;
}

interface SegmentedProps<V extends string> {
  value: V;
  options: SegmentOption<V>[];
  onChange: (value: V) => void;
  /** Names the group for assistive tech. */
  label: string;
  disabled?: boolean;
  className?: string;
}

/** Pill segmented control with a white thumb that springs to the pick. */
export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
  className = "",
}: SegmentedProps<V>) {
  const { ref, style } = useSlidingThumb<HTMLDivElement>(value, "x");
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={`v-seg ${className}`}
    >
      <span className="v-thumb" style={style} aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          disabled={disabled || o.disabled}
          onClick={() => o.value !== value && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
