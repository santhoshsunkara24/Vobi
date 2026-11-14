import React from "react";

/** Line icons drawn for Vobi (design/prototype). Decorative: hidden from AT. */
type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number, props: IconProps) => ({
  width: size,
  height: size,
  fill: "none",
  stroke: "currentColor",
  "aria-hidden": true,
  focusable: false,
  ...props,
});

export const HomeIcon: React.FC<IconProps> = ({ size = 19, ...p }) => (
  <svg
    viewBox="0 0 20 20"
    strokeWidth={1.7}
    strokeLinejoin="round"
    {...base(size, p)}
  >
    <path d="M3.5 8.5L10 3.5l6.5 5V16a.8.8 0 01-.8.8H4.3a.8.8 0 01-.8-.8z" />
    <path d="M8 16.8v-4.5h4v4.5" />
  </svg>
);

export const HistoryIcon: React.FC<IconProps> = ({ size = 19, ...p }) => (
  <svg
    viewBox="0 0 20 20"
    strokeWidth={1.7}
    strokeLinecap="round"
    {...base(size, p)}
  >
    <circle cx="10" cy="10" r="6.8" />
    <path d="M10 6.2V10l2.6 1.7" />
  </svg>
);

export const DictionaryIcon: React.FC<IconProps> = ({ size = 19, ...p }) => (
  <svg
    viewBox="0 0 20 20"
    strokeWidth={1.7}
    strokeLinejoin="round"
    {...base(size, p)}
  >
    <path d="M4.5 4h9.3a1.7 1.7 0 011.7 1.7V16H6.2a1.7 1.7 0 01-1.7-1.7z" />
    <path d="M4.5 14.3a1.7 1.7 0 011.7-1.7h9.3" />
  </svg>
);

export const SnippetsIcon: React.FC<IconProps> = ({ size = 19, ...p }) => (
  <svg
    viewBox="0 0 20 20"
    strokeWidth={1.7}
    strokeLinejoin="round"
    {...base(size, p)}
  >
    <path d="M11 2.8L5 11h5l-1 6.2L15 9h-5z" />
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 19, ...p }) => (
  <svg
    viewBox="0 0 20 20"
    strokeWidth={1.7}
    strokeLinecap="round"
    {...base(size, p)}
  >
    <path d="M3.5 6h7.5M14.5 6h2M3.5 14h2M9 14h7.5" />
    <circle cx="12.8" cy="6" r="1.8" />
    <circle cx="7.2" cy="14" r="1.8" />
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 18, ...p }) => (
  <svg
    viewBox="0 0 20 20"
    strokeWidth={1.8}
    strokeLinecap="round"
    {...base(size, p)}
  >
    <circle cx="9" cy="9" r="5.8" />
    <path d="M13.5 13.5l3.5 3.5" />
  </svg>
);

export const ArrowIcon: React.FC<IconProps> = ({ size = 18, ...p }) => (
  <svg
    viewBox="0 0 20 20"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...base(size, p)}
  >
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
);

export const MicIcon: React.FC<IconProps> = ({ size = 20, ...p }) => (
  <svg
    viewBox="0 0 16 16"
    strokeWidth={1.7}
    strokeLinecap="round"
    {...base(size, p)}
  >
    <rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" />
    <path d="M3 8a5 5 0 0010 0M8 13v1.8" />
  </svg>
);

export const UploadIcon: React.FC<IconProps> = ({ size = 20, ...p }) => (
  <svg
    viewBox="0 0 16 16"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...base(size, p)}
  >
    <path d="M8 10.5V2.5M5 5.5l3-3 3 3" />
    <path d="M2.5 9.5v3a1 1 0 001 1h9a1 1 0 001-1v-3" />
  </svg>
);

export const AddWordIcon: React.FC<IconProps> = ({ size = 20, ...p }) => (
  <svg
    viewBox="0 0 16 16"
    strokeWidth={1.7}
    strokeLinejoin="round"
    {...base(size, p)}
  >
    <path d="M3.5 3h7a1.5 1.5 0 011.5 1.5V13H5a1.5 1.5 0 01-1.5-1.5z" />
    <path d="M8 6v3.5M6.25 7.75h3.5" strokeLinecap="round" />
  </svg>
);

export const BoltIcon: React.FC<IconProps> = ({ size = 20, ...p }) => (
  <svg
    viewBox="0 0 16 16"
    strokeWidth={1.7}
    strokeLinejoin="round"
    {...base(size, p)}
  >
    <path d="M9 1.8L4 9h4l-1 5.2L12 7H8z" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 14, ...p }) => (
  <svg
    viewBox="0 0 14 14"
    strokeWidth={2}
    strokeLinecap="round"
    {...base(size, p)}
  >
    <path d="M7 2v10M2 7h10" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 10, ...p }) => (
  <svg
    viewBox="0 0 12 12"
    strokeWidth={1.9}
    strokeLinecap="round"
    {...base(size, p)}
  >
    <path d="M2 2l8 8M10 2l-8 8" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, ...p }) => (
  <svg
    viewBox="0 0 22 22"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...base(size, p)}
  >
    <path d="M5 11.5l4 4 8-9" />
  </svg>
);

export const ChevronIcon: React.FC<IconProps> = ({ size = 12, ...p }) => (
  <svg
    viewBox="0 0 12 12"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...base(size, p)}
  >
    <path d="M4.5 2.5L8 6l-3.5 3.5" />
  </svg>
);

export const SparkIcon: React.FC<IconProps> = ({ size = 16, ...p }) => (
  <svg
    viewBox="0 0 16 16"
    strokeWidth={1.8}
    strokeLinecap="round"
    {...base(size, p)}
  >
    <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" />
  </svg>
);
