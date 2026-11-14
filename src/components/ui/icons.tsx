/**
 * Bicon (by Hexline Design Studio, CC-BY-4.0; credited in Settings → About)
 * for the settings and onboarding components. Bicon draws a 1px line on a
 * 24px grid, which reads too thin at the 14–18px these controls use, so this
 * wraps the line styles with a 1.5px default. Pass `strokeWidth` to override.
 */
import React from "react";
import {
  AlertCircle as BAlertCircle,
  AlertTriangle as BAlertTriangle,
  ArrowDown as BArrowDown,
  Broadcast as BBroadcast,
  Check as BCheck,
  CheckCircle as BCheckCircle,
  ChevronDown as BChevronDown,
  ChevronRight as BChevronRight,
  Copy as BCopy,
  ExternalLink as BExternalLink,
  Globe as BGlobe,
  HelpCircle as BHelpCircle,
  InfoCircle as BInfoCircle,
  Keyboard as BKeyboard,
  Loader as BLoader,
  Lock as BLock,
  Mic as BMic,
  Pause as BPause,
  Plus as BPlus,
  Play as BPlay,
  Refresh as BRefresh,
  RotateCcw as BRotateCcw,
  Search as BSearch,
  Translate as BTranslate,
  Trash as BTrash,
  X as BX,
  type BiconIcon,
  type BiconProps,
} from "@hexline/bicon/react";

const line = (Icon: BiconIcon) => {
  const Wrapped = React.forwardRef<SVGSVGElement, BiconProps>((props, ref) => (
    <Icon strokeWidth={1.5} {...props} ref={ref} />
  ));
  Wrapped.displayName = Icon.displayName;
  return Wrapped;
};

export const AlertCircle = line(BAlertCircle);
export const AlertTriangle = line(BAlertTriangle);
export const ArrowDown = line(BArrowDown);
export const Broadcast = line(BBroadcast);
export const Check = line(BCheck);
export const CheckCircle = line(BCheckCircle);
export const ChevronDown = line(BChevronDown);
export const ChevronRight = line(BChevronRight);
export const Copy = line(BCopy);
export const ExternalLink = line(BExternalLink);
export const Globe = line(BGlobe);
export const HelpCircle = line(BHelpCircle);
export const InfoCircle = line(BInfoCircle);
export const Keyboard = line(BKeyboard);
export const Loader = line(BLoader);
export const Lock = line(BLock);
export const Mic = line(BMic);
export const Pause = line(BPause);
export const Plus = line(BPlus);
export const Play = line(BPlay);
export const Refresh = line(BRefresh);
export const RotateCcw = line(BRotateCcw);
export const Search = line(BSearch);
export const Translate = line(BTranslate);
export const Trash = line(BTrash);
export const X = line(BX);
