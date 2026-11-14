import React from "react";
import { RotateCcw } from "./icons";

interface ResetButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  children?: React.ReactNode;
}

export const ResetButton: React.FC<ResetButtonProps> = React.memo(
  ({ onClick, disabled = false, className = "", ariaLabel, children }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`grid size-[32px] place-items-center rounded-full transition-[background-color,color,transform] duration-150 ${
        disabled
          ? "opacity-50 cursor-not-allowed text-ink-3"
          : "cursor-pointer text-ink-2 hover:bg-surface-2 hover:text-text active:scale-90"
      } ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children ?? <RotateCcw size={18} />}
    </button>
  ),
);
