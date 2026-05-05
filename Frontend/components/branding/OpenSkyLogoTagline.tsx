/** Stacked OPEN SKY / ENABLING GROWTH — single color (`currentColor`), transparent. */
export function OpenSkyLogoTagline({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 360 92"
      className={className}
      fill="currentColor"
      role="img"
      aria-labelledby="opensky-tagline-title"
    >
      <title id="opensky-tagline-title">Open Sky — enabling growth</title>
      <text
        x="180"
        y="38"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="30"
        fontWeight="650"
        letterSpacing="0.16em"
      >
        OPEN SKY
      </text>
      <text
        x="180"
        y="74"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="12"
        fontWeight="550"
        letterSpacing="0.38em"
      >
        ENABLING GROWTH
      </text>
    </svg>
  );
}
