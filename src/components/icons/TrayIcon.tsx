import { VobiCloud, type CloudState } from "../vobi/VobiCloud";

/** The menu bar / system tray icon as drawn in onboarding: Vobi, in one colour. */
type TrayIconState = "idle" | "recording" | "transcribing";

const CLOUD_STATE: Record<TrayIconState, CloudState> = {
  idle: "idle",
  recording: "listening",
  transcribing: "transcribing",
};

const TrayIcon = ({ state, size }: { state: TrayIconState; size: number }) => (
  <VobiCloud size={size} mono state={CLOUD_STATE[state]} />
);

export default TrayIcon;
