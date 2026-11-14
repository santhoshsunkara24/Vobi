import React from "react";
import { useSettings } from "@/hooks/useSettings";
import { useOsType } from "@/hooks/useOsType";
import { keycapLabel, keycapLabels } from "@/lib/utils/keyboard";

/** The dictation shortcut as stored, e.g. "fn" or "ctrl_right". */
export const useTranscribeBinding = (): string => {
  const { settings } = useSettings();
  return settings?.bindings?.transcribe?.current_binding ?? "";
};

/** The dictation shortcut as plain text, for sentences and labels. */
export const useHotkeyText = (): string => {
  const binding = useTranscribeBinding();
  const os = useOsType();
  return binding ? keycapLabel(binding, os) : "";
};

/** The dictation shortcut drawn as small keycaps (prototype `.kbd`). */
export const HotkeyKbd: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  const binding = useTranscribeBinding();
  const os = useOsType();
  if (!binding) return null;
  return (
    <span
      className={`inline-flex items-center gap-[3px] align-middle ${className}`}
      role="img"
      aria-label={keycapLabel(binding, os)}
    >
      {keycapLabels(binding, os).map((label, i) => (
        <span key={i} className="v-kbd" aria-hidden="true">
          {label}
        </span>
      ))}
    </span>
  );
};
