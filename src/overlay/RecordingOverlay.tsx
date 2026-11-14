import { listen } from "@tauri-apps/api/event";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "@fontsource-variable/instrument-sans";
import "./RecordingOverlay.css";
import { commands, events } from "@/bindings";
import type {
  Notice,
  StreamPhase,
  StreamPhaseEvent,
  StreamTextEvent,
  StreamWorkKind,
} from "@/bindings";
import { VobiCloud, type CloudState } from "@/components/vobi/VobiCloud";
import i18n, { syncLanguageFromSettings } from "@/i18n";
import { noticeDisplay } from "@/lib/notices";
import type { ModelStateEvent } from "@/lib/types/events";
import { getLanguageDirection } from "@/lib/utils/rtl";

type OverlayState =
  | "recording"
  | "streaming"
  | "transcribing"
  | "processing"
  | "done"
  | "fix"
  | "refining"
  | "notice"
  | "live_notice";

const isNoticeState = (state: OverlayState) =>
  state === "notice" || state === "live_notice";

// Mic levels arrive as 16 FFT buckets; the pill shows the lower ones (speech).
const WAVE_BARS = 14;

// Only call out a model load in the Live preview once it has run this long.
const SLOW_MODEL_LOAD_MS = 2000;

// Matches the delay in `hide_recording_overlay`, so the pill can fade out.
const OVERLAY_FADE_MS = 300;

// Cloud slot (52) + gaps + right padding around a notice title.
const NOTICE_PILL_CHROME = 78;

const CLOUD_SIZE = 46;

// What "Fix selection" did (from the backend's `overlay-fix` event).
type FixResult = {
  kind: "fixed" | "clean" | "empty" | "failed" | "refined" | "nokey";
  fixes: { from: string; to: string }[];
  words: number;
};

const UNDO_KEYS = /Mac/.test(navigator.userAgent) ? "⌘Z" : "Ctrl+Z";

const RecordingOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  // `Stream::play()` returning does not mean hardware callbacks are flowing:
  // stay in an arming state until the first microphone samples arrive.
  const [captureReady, setCaptureReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoadSlow, setModelLoadSlow] = useState(false);
  const modelLoadTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [loadNoticeShown, setLoadNoticeShown] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(WAVE_BARS).fill(0));
  const [streamText, setStreamText] = useState<StreamTextEvent>({
    committed: "",
    tentative: "",
  });
  const [phase, setPhase] = useState<StreamPhase>("listening");
  const [workKind, setWorkKind] = useState<StreamWorkKind>("transcribing");
  const [elapsed, setElapsed] = useState(0);
  const [doneWords, setDoneWords] = useState(0);
  const [fix, setFix] = useState<FixResult | null>(null);
  const [session, setSession] = useState(0);
  const [position, setPosition] = useState<"top" | "bottom">("bottom");
  const [overflowing, setOverflowing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [noticeWidth, setNoticeWidth] = useState<number>();
  const noticeProbeRef = useRef<HTMLSpanElement>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const smoothedLevelsRef = useRef<number[]>(Array(16).fill(0));
  const capRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const direction = getLanguageDirection(i18n.language);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const setupEventListeners = async () => {
      const unlistenNotice = await listen<Notice>("overlay-notice", (event) => {
        clearTimeout(fadeTimerRef.current);
        setNotice(event.payload);
      });

      const unlistenShow = await listen("show-overlay", async (event) => {
        const overlayState = event.payload as OverlayState;
        clearTimeout(fadeTimerRef.current);
        if (!isNoticeState(overlayState)) setNotice(null);
        // Reset synchronously before settings I/O: a fast microphone can emit
        // recording-ready while the awaits below are in flight.
        if (overlayState === "recording" || overlayState === "streaming") {
          setCaptureReady(false);
          setElapsed(0);
          smoothedLevelsRef.current = Array(16).fill(0);
          setLevels(Array(WAVE_BARS).fill(0));
          setStreamText({ committed: "", tentative: "" });
        }

        await syncLanguageFromSettings();
        try {
          const settings = await commands.getAppSettings();
          if (settings.status === "ok") {
            setPosition(
              settings.data.overlay_position === "top" ? "top" : "bottom",
            );
          }
        } catch {
          // Keep the previous placement if settings can't be read.
        }
        setState(overlayState);
        if (overlayState === "streaming") {
          setPhase("listening");
          setWorkKind("transcribing");
          setLoadNoticeShown(false);
          setSession((s) => s + 1);
        }
        setIsVisible(true);
      });

      // Text landed: a short happy beat before the backend hides the pill.
      const unlistenDone = await listen<number>("overlay-done", (event) => {
        clearTimeout(fadeTimerRef.current);
        setDoneWords(event.payload ?? 0);
        setNotice(null);
        setState("done");
        setIsVisible(true);
      });

      const unlistenFix = await listen<FixResult>("overlay-fix", (event) => {
        clearTimeout(fadeTimerRef.current);
        setFix(event.payload);
        setNotice(null);
        setState("fix");
        setIsVisible(true);
      });

      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
        setCaptureReady(false);
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = setTimeout(() => {
          setNotice(null);
          setStreamText({ committed: "", tentative: "" });
        }, OVERLAY_FADE_MS);
      });

      const unlistenReady = await listen("recording-ready", () => {
        setElapsed(0);
        setCaptureReady(true);
      });

      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        const newLevels = event.payload as number[];
        const smoothed = smoothedLevelsRef.current.map((prev, i) => {
          const target = newLevels[i] || 0;
          return prev * 0.7 + target * 0.3;
        });
        smoothedLevelsRef.current = smoothed;
        setLevels(smoothed.slice(0, WAVE_BARS));
      });

      const unlistenStream = await events.streamTextEvent.listen((event) => {
        setStreamText(event.payload);
      });

      const unlistenPhase = await events.streamPhaseEvent.listen((event) => {
        const payload: StreamPhaseEvent = event.payload;
        setPhase(payload.phase);
        if (payload.kind) setWorkKind(payload.kind);
      });

      // Every `loading_started` ends with exactly one completed or failed.
      const unlistenModel = await listen<ModelStateEvent>(
        "model-state-changed",
        (event) => {
          const type = event.payload.event_type;
          if (type === "loading_started") {
            clearTimeout(modelLoadTimerRef.current);
            setModelLoading(true);
            setModelLoadSlow(false);
            modelLoadTimerRef.current = setTimeout(
              () => setModelLoadSlow(true),
              SLOW_MODEL_LOAD_MS,
            );
          } else if (
            type === "loading_completed" ||
            type === "loading_failed"
          ) {
            clearTimeout(modelLoadTimerRef.current);
            setModelLoading(false);
            setModelLoadSlow(false);
          }
        },
      );

      cleanup = () => {
        unlistenNotice();
        unlistenShow();
        unlistenDone();
        unlistenFix();
        unlistenHide();
        unlistenReady();
        unlistenLevel();
        unlistenStream();
        unlistenPhase();
        unlistenModel();
        clearTimeout(modelLoadTimerRef.current);
        clearTimeout(fadeTimerRef.current);
      };
    };

    setupEventListeners();
    return () => cleanup?.();
  }, []);

  // Elapsed timer, once microphone samples are flowing.
  useEffect(() => {
    const live = state === "streaming" || state === "recording";
    if (!live || !isVisible || !captureReady) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [state, isVisible, captureReady]);

  useLayoutEffect(() => {
    const el = capRef.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
    if (pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [streamText]);

  useEffect(() => {
    if (modelLoadSlow && state === "streaming") setLoadNoticeShown(true);
  }, [modelLoadSlow, state, session]);

  useEffect(() => {
    pinnedRef.current = true;
    setOverflowing(false);
  }, [session]);

  const shownNotice = notice && isNoticeState(state) ? notice : null;
  const noticeTitle = shownNotice
    ? t(noticeDisplay(shownNotice.code).title)
    : "";

  // CSS can't animate to an intrinsic width, so a notice pill gets a measured one.
  useLayoutEffect(() => {
    const probe = noticeProbeRef.current;
    if (!probe) return;
    setNoticeWidth(
      Math.ceil(probe.getBoundingClientRect().width) + NOTICE_PILL_CHROME,
    );
  }, [noticeTitle, isVisible]);

  if (!isVisible && !shownNotice) return null;

  const handleStreamScroll = () => {
    const el = capRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 16;
  };

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Overall loudness for the cloud: mean of the speech buckets, lifted a bit
  // so normal talking reads clearly.
  const voice = Math.min(
    1,
    Math.pow(levels.reduce((a, b) => a + b, 0) / WAVE_BARS, 0.6) * 1.6,
  );

  const transcribingLabel = modelLoading
    ? t("overlay.loadingModel")
    : t("overlay.transcribing");

  const cloud = (cloudState: CloudState) => (
    <span className="vslot">
      <VobiCloud
        size={CLOUD_SIZE}
        state={cloudState}
        level={cloudState === "listening" ? voice : 0}
      />
    </span>
  );

  const waveform = (
    <div className={`vwave ${captureReady ? "ready" : "arming"}`}>
      {levels.map((v, i) => (
        <i
          key={i}
          style={{
            transform: `scaleY(${Math.max(0.14, Math.min(1, 0.14 + Math.pow(v, 0.7) * 0.86)).toFixed(3)})`,
          }}
        />
      ))}
    </div>
  );

  const cancelBtn = (
    <button
      className="vround"
      aria-label={t("overlay.cancel")}
      onClick={() => commands.cancelOperation()}
    >
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );

  const listeningRow = (showTimer: boolean) => (
    <div className="vrow">
      {cloud(captureReady ? "listening" : "idle")}
      {waveform}
      {showTimer && <span className="vtimer">{fmtTime(elapsed)}</span>}
      {cancelBtn}
    </div>
  );

  const workingRow = (label: string) => (
    <div className="vrow">
      {cloud("thinking")}
      <span className="vshimmer">{label}</span>
      {cancelBtn}
    </div>
  );

  const doneRow = (
    <div className="vrow">
      {cloud("done")}
      <svg className="vcheck" viewBox="0 0 22 22" aria-hidden="true">
        <path
          d="M5 11.5l4 4 8-9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="vdone">
        <b>{t("overlay.pasted")}</b>
        {doneWords > 0 && (
          <span>{t("overlay.words", { count: doneWords })}</span>
        )}
      </span>
    </div>
  );

  const fixRow = fix && (
    <div className="vrow">
      {cloud(
        fix.kind === "fixed" || fix.kind === "clean" || fix.kind === "refined"
          ? "done"
          : fix.kind === "failed"
            ? "error"
            : "idle",
      )}
      {fix.kind === "fixed" ||
      fix.kind === "clean" ||
      fix.kind === "refined" ? (
        <svg className="vcheck" viewBox="0 0 22 22" aria-hidden="true">
          <path
            d="M5 11.5l4 4 8-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
      <span className="vfix">
        {fix.kind === "refined" ? (
          <>
            <b>{t("overlay.refined")}</b>
            <span className="vfix-list">
              <span>{t("overlay.words", { count: fix.words })}</span>
              <span>{t("overlay.undoHint", { keys: UNDO_KEYS })}</span>
            </span>
          </>
        ) : fix.kind === "fixed" ? (
          <>
            <b>{t("overlay.fixed", { count: fix.fixes.length })}</b>
            <span className="vfix-list">
              {fix.fixes.slice(0, 3).map((f, i) => (
                <span key={i} className="vfix-item">
                  <s>{f.from}</s>
                  <i aria-hidden="true">→</i>
                  {f.to}
                </span>
              ))}
              {fix.fixes.length > 3 && (
                <span className="vfix-more">
                  {t("overlay.fixMore", { count: fix.fixes.length - 3 })}
                </span>
              )}
            </span>
          </>
        ) : (
          <b className={fix.kind === "failed" ? "is-error" : ""}>
            {fix.kind === "clean"
              ? t("overlay.noMistakes")
              : fix.kind === "empty"
                ? t("overlay.selectFirst")
                : fix.kind === "nokey"
                  ? t("overlay.needAiKey")
                  : t("overlay.fixFailed")}
          </b>
        )}
      </span>
    </div>
  );

  const noticeRow = shownNotice && (
    <div className="vrow">
      {cloud(shownNotice.level === "error" ? "error" : "idle")}
      <span className={`vnotice level-${shownNotice.level}`}>
        {noticeTitle}
      </span>
    </div>
  );
  const noticeProbe = shownNotice && (
    <span ref={noticeProbeRef} className="vnotice vprobe" aria-hidden="true">
      {noticeTitle}
    </span>
  );
  const dismissNotice = shownNotice
    ? () => commands.dismissOverlayNotice()
    : undefined;

  // ---- Live overlay: the pill opens upward (or downward) into a text card ----
  const liveNotice = state === "live_notice" ? shownNotice : null;
  if (state === "streaming" || liveNotice) {
    const hasText =
      streamText.committed.length > 0 || streamText.tentative.length > 0;
    const working = !liveNotice && phase === "working";
    const noticeText =
      liveNotice && !hasText
        ? (noticeDisplay(liveNotice.code).explanation?.(t) ?? liveNotice.detail)
        : null;
    const loadingNotice = !liveNotice && modelLoadSlow && !working && !hasText;
    const open = liveNotice
      ? hasText || !!noticeText
      : hasText || loadingNotice || (loadNoticeShown && !working);

    return (
      <div dir={direction} className={`vstage ${position}`}>
        {noticeProbe}
        <div
          key={session}
          className={`vcard live ${open ? "open" : ""} ${working ? "working" : ""} ${
            isVisible ? "" : "leaving"
          }`}
          style={liveNotice && !open ? { width: noticeWidth } : undefined}
          onClick={dismissNotice}
        >
          <div className="vtext">
            <div className="vtext-clip">
              <div
                className={`vtext-cap ${overflowing ? "overflowing" : ""}`}
                ref={capRef}
                onScroll={handleStreamScroll}
              >
                <p>
                  {loadingNotice && (
                    <span className="vloading">
                      {t("overlay.loadingModel")}
                    </span>
                  )}
                  {noticeText && <span className="vdetail">{noticeText}</span>}
                  <span className="committed">
                    {streamText.committed ? streamText.committed + " " : ""}
                  </span>
                  <span className="tentative">{streamText.tentative}</span>
                  {!working && !loadingNotice && !liveNotice && (
                    <span className="vcaret" />
                  )}
                </p>
              </div>
            </div>
          </div>
          {liveNotice
            ? noticeRow
            : working
              ? workingRow(
                  workKind === "polishing"
                    ? t("overlay.processing")
                    : transcribingLabel,
                )
              : listeningRow(true)}
        </div>
      </div>
    );
  }

  // ---- Compact pill: one row at a time, the pill animates its width ----
  const working =
    state === "transcribing" || state === "processing" || state === "refining";
  const workLabel =
    state === "refining"
      ? t("overlay.refining")
      : state === "processing"
        ? t("overlay.processing")
        : transcribingLabel;
  const mode = shownNotice
    ? "m-notice"
    : state === "fix"
      ? "m-fix"
      : state === "done"
        ? "m-done"
        : working
          ? "m-working"
          : "m-listening";

  return (
    <div
      dir={direction}
      className={`vstage ${position} vfade ${isVisible ? "show" : ""}`}
    >
      {noticeProbe}
      <div
        className={`vcard compact ${mode}`}
        style={shownNotice ? { width: noticeWidth } : undefined}
        onClick={dismissNotice}
      >
        {shownNotice
          ? noticeRow
          : state === "fix" && fixRow
            ? fixRow
            : state === "done"
              ? doneRow
              : working
                ? workingRow(workLabel)
                : listeningRow(true)}
      </div>
    </div>
  );
};

export default RecordingOverlay;
