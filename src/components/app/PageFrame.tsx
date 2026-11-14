import React from "react";
import { StatusCluster } from "./StatusCluster";

interface PageFrameProps {
  title: string;
  /** Muted text after the title's dot, e.g. "4,210 words this week". */
  count?: string | null;
  /** Small things at the header's far end (status, search). */
  side?: React.ReactNode;
  /** The action row: a black pill, a divider, soft chips. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Let the body fill the panel's height (Settings → Model). */
  fill?: boolean;
}

/** A page: light title with a muted count, the action row, then the body. */
export const PageFrame: React.FC<PageFrameProps> = ({
  title,
  count,
  side,
  actions,
  children,
  fill = false,
}) => (
  <>
    <header className="v-head">
      <h1>
        <span className="truncate">{title}</span>
        {count && (
          <>
            <span className="v-dot" aria-hidden="true" />
            <span className="v-count">{count}</span>
          </>
        )}
      </h1>
      <div className="v-head-side">
        <StatusCluster />
        {side}
      </div>
    </header>
    {actions && <div className="v-actions-row">{actions}</div>}
    <div
      className={`v-scroll ${fill ? "flex flex-col" : ""}`}
      data-page-scroll=""
    >
      <div className={`v-body ${fill ? "flex min-h-0 flex-1 flex-col" : ""}`}>
        {children}
      </div>
    </div>
  </>
);

/** A soft chip in the action row, with an optional count. */
export const ChipButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: React.ReactNode;
    n?: number | string | null;
    pressed?: boolean;
  }
> = ({ icon, n, pressed, children, ...rest }) => (
  <button type="button" className="v-chip-btn" aria-pressed={pressed} {...rest}>
    {icon}
    {children}
    {n != null && <span className="v-n">{n}</span>}
  </button>
);

/** The thin vertical divider between the pill and the chips. */
export const Divider: React.FC = () => (
  <span className="v-vr" aria-hidden="true" />
);
