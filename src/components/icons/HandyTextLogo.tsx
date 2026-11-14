// Temporary Vobi wordmark. Replaced by the real brand in Phase 3.
const HandyTextLogo = ({
  width,
  height,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) => {
  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox="0 0 300 100"
      role="img"
      aria-label="Vobi"
    >
      <text
        x="0"
        y="78"
        fontFamily="-apple-system, 'Segoe UI Variable Display', 'Segoe UI', sans-serif"
        fontSize="92"
        fontWeight="700"
        letterSpacing="-3"
        fill="#2563EB"
      >
        {/* eslint-disable-next-line i18next/no-literal-string */}
        vobi
      </text>
    </svg>
  );
};

export default HandyTextLogo;
