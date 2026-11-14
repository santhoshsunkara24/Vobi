import React from "react";
import { InfoCircle } from "@/components/ui/icons";
import { Tooltip } from "./Tooltip";

interface InfoTooltipProps {
  title?: React.ReactNode;
  text: React.ReactNode;
  placement?: "above" | "below";
}

/** An info icon that explains something in a tooltip. */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  text,
  placement = "above",
}) => (
  <Tooltip title={title} text={text} placement={placement} showOnPress>
    <button
      type="button"
      aria-label="More information"
      className="grid cursor-help text-ink-3 transition-colors duration-200 hover:text-logo-primary"
    >
      <InfoCircle size={16} className="w-4 h-4" />
    </button>
  </Tooltip>
);
