import React from "react";

interface SettingContainerProps {
  title: string;
  description: string;
  children: React.ReactNode;
  /** Kept for API compatibility: descriptions always show under the title. */
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  layout?: "horizontal" | "stacked";
  disabled?: boolean;
  tooltipPosition?: "top" | "bottom";
  /** Horizontal only: the control takes the row's free width, for content that fits itself to it. */
  grow?: boolean;
}

/** One setting row: title and quiet description on the left, control on the right. */
export const SettingContainer: React.FC<SettingContainerProps> = ({
  title,
  description,
  children,
  grouped = false,
  layout = "horizontal",
  disabled = false,
  grow = false,
}) => {
  const frame = grouped ? "" : "v-card px-[18px]";
  const label = (
    <div className={disabled ? "opacity-45" : ""}>
      <h3 className="m-0 text-[14.5px] leading-[1.35] font-semibold text-text">
        {title}
      </h3>
      {description && (
        <p className="mt-[2px] mb-0 max-w-[520px] text-[13px] leading-[1.45] text-ink-3 text-pretty">
          {description}
        </p>
      )}
    </div>
  );

  if (layout === "stacked") {
    return (
      <div className={`py-[14px] ${frame}`}>
        <div className="mb-[10px]">{label}</div>
        <div className="w-full">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-[62px] items-center justify-between gap-[14px] py-[10px] ${frame}`}
    >
      <div className={grow ? "max-w-[50%] shrink-0" : "min-w-0 flex-1"}>
        {label}
      </div>
      <div
        className={
          grow
            ? "relative flex min-w-0 flex-1 justify-end"
            : "relative shrink-0"
        }
      >
        {children}
      </div>
    </div>
  );
};
