import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/hooks/useSettings";
import { type OSType } from "@/lib/utils/keyboard";
import { prefersReducedMotion } from "@/lib/utils/motion";
import { VobiCloud, type CloudState } from "@/components/vobi/VobiCloud";
import { Button } from "../../ui/Button";
import { Keycaps } from "../../shared/Keycaps";
import { DesktopBar } from "../DesktopBar";
import { WindowBar } from "../WindowBar";
import { OnboardingShell, ScreenHeader, ScreenMain } from "../OnboardingShell";
import "./demo.css";
import "./tricks.css";

type Trick = "fix" | "refine";

/**
 * What the drawn screen shows at each beat.
 * - select: the text gets highlighted, as if dragged over
 * - press:  the shortcut goes down
 * - work:   the pill shows Vobi working (fixing / refining)
 * - result: Fix: the words are corrected; Refine: the preview card is up
 * - paste:  Refine only: the pointer clicks Paste
 * - done:   the new text is in place, the pill says so
 * - rest:   the pill fades, the selection clears
 */
type Beat =
  | "idle"
  | "select"
  | "press"
  | "work"
  | "result"
  | "paste"
  | "done"
  | "rest";

/** Each trick's beats, in ms from its start, then the other trick plays. */
const SCRIPTS: Record<Trick, { script: [number, Beat][]; ms: number }> = {
  fix: {
    script: [
      [0, "idle"],
      [500, "select"],
      [1500, "press"],
      [1900, "work"],
      [2700, "result"],
      [2750, "done"],
      [4700, "rest"],
    ],
    ms: 5600,
  },
  refine: {
    script: [
      [0, "idle"],
      [500, "select"],
      [1500, "press"],
      [1900, "work"],
      [3300, "result"],
      [5600, "paste"],
      [6100, "done"],
      [8000, "rest"],
    ],
    ms: 8900,
  },
};

const DEFAULT_KEYS: Record<Trick, { mac: string; other: string }> = {
  fix: { mac: "option+shift+f", other: "alt+shift+f" },
  refine: { mac: "option+shift+r", other: "alt+shift+r" },
};

/**
 * Fix's sentence, with its typos as numbers. Spelling fixes are English, so
 * the sample stays English in every app language.
 */
const FIX_SENTENCE: (string | number)[] = [
  "Can we meet ",
  0,
  " near the ",
  1,
  "? I'll ",
  2,
  " the keys at noon.",
];
const TYPOS = ["tomorow", "ofice", "recieve"];
const FIXES = ["tomorrow", "office", "receive"];
const FIX_SUMMARY = `${TYPOS[0]} → ${FIXES[0]}`;

interface TricksProps {
  progress: { index: number; count: number };
  os: OSType;
  onBack: () => void;
  onContinue: () => void;
}

/** "Fix and Refine": what Vobi does with text you've already written. */
export const Tricks: React.FC<TricksProps> = ({
  progress,
  os,
  onBack,
  onContinue,
}) => {
  const { t } = useTranslation();
  const { getSetting } = useSettings();
  const bindings = getSetting("bindings");
  const keysFor = (trick: Trick) =>
    bindings?.[trick === "fix" ? "fix_selection" : "refine_selection"]
      ?.current_binding ||
    (os === "macos" ? DEFAULT_KEYS[trick].mac : DEFAULT_KEYS[trick].other);

  const still = prefersReducedMotion();
  const [trick, setTrick] = useState<Trick>("fix");
  const [beat, setBeat] = useState<Beat>(still ? "done" : "idle");
  // Bumped to restart the loop when a tab is picked.
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (still) {
      setBeat(trick === "fix" ? "done" : "result");
      return;
    }
    const { script, ms } = SCRIPTS[trick];
    const timers = script.map(([at, b]) => setTimeout(() => setBeat(b), at));
    timers.push(
      setTimeout(() => setTrick((x) => (x === "fix" ? "refine" : "fix")), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [trick, run, still]);

  const pick = (to: Trick) => {
    setTrick(to);
    setBeat(still ? beat : "idle");
    setRun((n) => n + 1);
  };

  const caption =
    trick === "fix"
      ? t("onboarding.tricks.fixCaption")
      : os === "macos"
        ? t("onboarding.tricks.refineCaptionMac")
        : t("onboarding.tricks.refineCaptionOther");

  return (
    <OnboardingShell
      progress={progress}
      onBack={onBack}
      primary={
        <Button variant="primary" size="lg" onClick={onContinue}>
          {t("onboarding.demo.tryIt")}
        </Button>
      }
    >
      <ScreenMain
        header={
          <ScreenHeader
            title={t("onboarding.tricks.title")}
            sub={t("onboarding.tricks.subtitle")}
          />
        }
      >
        <div className="tricks-tabs" role="tablist">
          {(["fix", "refine"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={trick === k}
              className="tricks-tab"
              onClick={() => pick(k)}
            >
              <span>
                {t(
                  k === "fix"
                    ? "onboarding.tricks.fixTab"
                    : "onboarding.tricks.refineTab",
                )}
              </span>
              <Keycaps binding={keysFor(k)} osType={os} size="screen" />
              {trick === k && !still && (
                <i
                  key={`${k}-${run}`}
                  className="tricks-tab-bar"
                  style={{ animationDuration: `${SCRIPTS[k].ms}ms` }}
                />
              )}
            </button>
          ))}
        </div>

        <TricksLaptop
          os={os}
          trick={trick}
          beat={beat}
          keys={keysFor(trick)}
          key={`${trick}-${run}`}
        />

        <p key={trick} className="tricks-caption">
          {caption}
        </p>
      </ScreenMain>
    </OnboardingShell>
  );
};

/* ---------------- the drawn laptop ---------------- */

const TricksLaptop: React.FC<{
  os: OSType;
  trick: Trick;
  beat: Beat;
  keys: string;
}> = ({ os, trick, beat, keys }) => {
  const { t } = useTranslation();
  const at = (b: Beat) => order(trick, beat) >= order(trick, b);
  const selected = at("select") && !at("rest");
  const fixed = trick === "fix" && at("result");
  const pasted = trick === "refine" && at("done");

  // The pointer: drags over the text, then (Refine) heads for Paste.
  const screenRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const pasteRef = useRef<HTMLSpanElement>(null);
  const [pointer, setPointer] = useState({ x: 330, y: 210, on: false });
  useLayoutEffect(() => {
    const sc = screenRef.current?.getBoundingClientRect();
    const tx = textRef.current?.getBoundingClientRect();
    if (!sc || !tx) return;
    if (beat === "idle") {
      setPointer({
        x: tx.left - sc.left - 2,
        y: tx.top - sc.top + 8,
        on: true,
      });
    } else if (beat === "select") {
      setPointer({
        x: tx.right - sc.left - 6,
        y: tx.bottom - sc.top - 8,
        on: true,
      });
    } else if (beat === "result" && trick === "refine") {
      const p = pasteRef.current?.getBoundingClientRect();
      if (p)
        setPointer({
          x: p.left - sc.left + p.width / 2,
          y: p.top - sc.top + p.height / 2,
          on: true,
        });
    } else if (beat === "paste") {
      setPointer((p) => ({ ...p, on: true }));
    } else {
      setPointer((p) => ({ ...p, on: false }));
    }
  }, [beat, trick]);

  const face: CloudState =
    beat === "work"
      ? trick === "fix"
        ? "fixing"
        : "refining"
      : at("done") || (trick === "fix" && at("result"))
        ? "done"
        : "idle";

  const pill =
    beat === "work" ||
    (trick === "fix" && at("result") && !at("rest")) ||
    (trick === "refine" && at("done") && !at("rest"));
  const card = trick === "refine" && (beat === "result" || beat === "paste");

  return (
    <div
      role="img"
      aria-label={t(
        trick === "fix"
          ? "onboarding.tricks.fixLabel"
          : "onboarding.tricks.refineLabel",
      )}
      className="demo-laptop tricks-laptop"
    >
      <div className="demo-lid">
        <span className="demo-cam" />
        <div ref={screenRef} className="demo-screen">
          <DesktopBar os={os} size="demo" state="idle" />
          <div className="demo-app tricks-app" data-focused>
            <WindowBar size="sm" title={t("onboarding.demo.apps.notes")} />
            <div className="demo-app-body tricks-body">
              <p className="demo-note-title">
                {t(
                  trick === "fix"
                    ? "onboarding.tricks.fixNoteTitle"
                    : "onboarding.tricks.refineNoteTitle",
                )}
              </p>
              <p className="tricks-text">
                <span
                  ref={textRef}
                  className={`tricks-sel ${selected ? "is-on" : ""}`}
                >
                  {trick === "fix" ? (
                    <FixSentence fixed={fixed} />
                  ) : pasted ? (
                    <span className="tricks-new">
                      {t("onboarding.tricks.refineAfter")}
                    </span>
                  ) : (
                    t("onboarding.tricks.refineBefore")
                  )}
                </span>
              </p>
            </div>
          </div>

          {/* The pill: Vobi's face says what it's doing. */}
          <div className={`tricks-pill ${pill ? "is-on" : ""}`}>
            <VobiCloud size={26} state={face} />
            <span className="tricks-pill-text">
              {beat === "work" ? (
                <span className="tricks-shimmer">
                  {t(trick === "fix" ? "overlay.fixing" : "overlay.refining")}
                </span>
              ) : trick === "fix" ? (
                <>
                  <b>{t("onboarding.tricks.fixedThree")}</b>
                  <span className="tricks-pill-sub">{FIX_SUMMARY}</span>
                </>
              ) : (
                <b>{t("overlay.refined")}</b>
              )}
            </span>
          </div>

          {/* Refine's preview card: read it, then Paste. */}
          <div className={`tricks-card ${card ? "is-on" : ""}`}>
            <div className="tricks-card-head">
              <VobiCloud size={22} state="idle" />
              <b>{t("overlay.refined")}</b>
            </div>
            <p className="tricks-card-text">
              {card &&
                t("onboarding.tricks.refineAfter")
                  .split(" ")
                  .map((w, i) => (
                    <span
                      key={i}
                      className="tricks-word"
                      style={{ animationDelay: `${i * 28}ms` }}
                    >
                      {w}{" "}
                    </span>
                  ))}
            </p>
            <div className="tricks-card-actions">
              <span className="tricks-btn">{t("overlay.refineAgain")}</span>
              <span
                ref={pasteRef}
                className={`tricks-btn is-primary ${beat === "paste" ? "is-down" : ""}`}
              >
                {t("overlay.paste")}
              </span>
            </div>
          </div>

          <div
            className={`demo-keys tricks-keys ${card || pill ? "is-off" : ""}`}
          >
            <Keycaps
              binding={keys}
              osType={os}
              size="screen"
              pressed={beat === "press" || beat === "work"}
            />
          </div>

          <span
            className="demo-pointer tricks-pointer"
            data-on={pointer.on || undefined}
            data-drag={beat === "select" || undefined}
            style={{ transform: `translate(${pointer.x}px, ${pointer.y}px)` }}
          >
            {beat === "paste" && <i className="demo-click" />}
            <svg width="14" height="20" viewBox="0 0 11 16" aria-hidden="true">
              <path
                d="M1 1v12.2l3-2.9 1.9 4.5 2-.9-1.9-4.4h4.1z"
                fill="#111"
                stroke="#fff"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
      <div className="demo-base">
        <span className="demo-notch" />
      </div>
      <div className="demo-floor" />
    </div>
  );
};

/** The sample sentence, its typos corrected in place once `fixed`. */
const FixSentence: React.FC<{ fixed: boolean }> = ({ fixed }) => (
  <span lang="en">
    {FIX_SENTENCE.map((p, i) =>
      typeof p === "string" ? (
        <React.Fragment key={i}>{p}</React.Fragment>
      ) : (
        <span
          key={i}
          className={`tricks-typo ${fixed ? "is-fixed" : ""}`}
          style={{ animationDelay: `${p * 90}ms` }}
        >
          {fixed ? FIXES[p] : TYPOS[p]}
        </span>
      ),
    )}
  </span>
);

const order = (trick: Trick, b: Beat) => {
  const list = SCRIPTS[trick].script.map(([, x]) => x);
  const i = list.indexOf(b);
  return i < 0 ? -1 : i;
};
