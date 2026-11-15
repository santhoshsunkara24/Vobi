import React, { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { commands } from "@/bindings";
import { VobiCloud, type CloudState } from "@/components/vobi/VobiCloud";
import "./buddy.css";

/** What the recording pill is showing, as Vobi's face. */
const STATE_FACE: Record<string, CloudState> = {
  recording: "listening",
  streaming: "listening",
  transcribing: "transcribing",
  processing: "refining",
  refining: "refining",
  fixing: "fixing",
};

/** A Fix / Refine result, as Vobi's face (as on the pill). */
const RESULT_FACE: Record<string, CloudState> = {
  fixed: "done",
  refined: "done",
  clean: "clean",
  empty: "confused",
  failed: "error",
  nokey: "sleepy",
};

/** How long a result face stays before Vobi relaxes again. */
const RESULT_MS = 2600;
/** Pointer travel (px) that turns a press into a drag. */
const DRAG_PX = 4;

/**
 * Vobi on screen: the cloud with legs. Click to talk or to fix the selected
 * text; drag to move; right-click for more (all handled in buddy.rs).
 */
const Buddy: React.FC = () => {
  const [face, setFace] = useState<CloudState>("idle");
  const [level, setLevel] = useState(0);
  const [carried, setCarried] = useState(false);
  // Petting: the pointer resting on Vobi (watched by buddy.rs).
  const [petting, setPetting] = useState(false);
  const [petSide, setPetSide] = useState(0);
  const [strokes, setStrokes] = useState(0);
  const resultTimer = useRef<ReturnType<typeof setTimeout>>();
  const settleTimer = useRef<ReturnType<typeof setTimeout>>();
  const down = useRef<{ x: number; y: number } | null>(null);
  // While a result face shows, a hide shouldn't cut it short.
  const holding = useRef(false);

  useEffect(() => {
    const showResult = (next: CloudState) => {
      clearTimeout(resultTimer.current);
      holding.current = true;
      setFace(next);
      resultTimer.current = setTimeout(() => {
        holding.current = false;
        setFace("idle");
      }, RESULT_MS);
    };
    const working = (next: CloudState) => {
      clearTimeout(resultTimer.current);
      holding.current = false;
      setFace(next);
    };

    const unlisten = Promise.all([
      listen<string>("show-overlay", (e) => {
        const next = STATE_FACE[e.payload];
        if (next) working(next);
      }),
      listen<{ kind: string }>("overlay-fix", (e) =>
        showResult(RESULT_FACE[e.payload.kind] ?? "idle"),
      ),
      listen<{ busy: boolean }>("overlay-preview", (e) =>
        working(e.payload.busy ? "refining" : "idle"),
      ),
      listen("overlay-done", () => showResult("done")),
      listen("hide-overlay", () => {
        if (!holding.current) setFace("idle");
      }),
      listen<number[]>("mic-level", (e) => {
        const v = e.payload;
        const mean = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
        setLevel(Math.min(1, Math.pow(mean, 0.6) * 1.6));
      }),
      listen<{ over: boolean; side: number; stroke: boolean }>(
        "buddy-hover",
        (e) => {
          setPetting(e.payload.over);
          setPetSide(Math.round(e.payload.side * 4) / 4);
          if (e.payload.stroke) setStrokes((n) => n + 1);
        },
      ),
      // Dragging: dangle while it moves, settle once it stops.
      getCurrentWindow().onMoved(() => {
        setCarried(true);
        clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => setCarried(false), 260);
      }),
    ]);
    return () => {
      clearTimeout(resultTimer.current);
      clearTimeout(settleTimer.current);
      unlisten.then((fns) => fns.forEach((f) => f()));
    };
  }, []);

  return (
    <div
      className={`buddy ${carried ? "is-carried" : ""}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        down.current = { x: e.screenX, y: e.screenY };
      }}
      onPointerMove={(e) => {
        const start = down.current;
        if (!start) return;
        if (Math.hypot(e.screenX - start.x, e.screenY - start.y) < DRAG_PX)
          return;
        down.current = null;
        setCarried(true);
        getCurrentWindow()
          .startDragging()
          .catch(() => setCarried(false));
      }}
      onPointerUp={() => {
        if (down.current) commands.buddyClick();
        down.current = null;
      }}
      onPointerCancel={() => {
        down.current = null;
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        down.current = null;
        commands.buddyMenu();
      }}
    >
      <VobiCloud
        size={76}
        state={face}
        level={face === "listening" ? level : 0}
        legs
        shadow
        carried={carried}
        petting={petting && !carried}
        petSide={petSide}
        petStrokes={strokes}
      />
    </div>
  );
};

export default Buddy;
