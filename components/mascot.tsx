export function Mascot({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 240"
      role="img"
      aria-label="考え中の伝心くん"
      className={className}
    >
      <circle cx="112" cy="132" r="84" fill="#d7ffb8" />
      <circle cx="112" cy="132" r="68" fill="#58cc02" />
      <circle cx="88" cy="122" r="9" fill="#000437" />
      <circle cx="136" cy="122" r="9" fill="#000437" />
      <path
        d="M86 150c14 16 38 16 52 0"
        fill="none"
        stroke="#000437"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <circle cx="70" cy="146" r="7" fill="#ff9600" opacity="0.75" />
      <circle cx="154" cy="146" r="7" fill="#ff9600" opacity="0.75" />
      <circle
        cx="188"
        cy="60"
        r="6"
        fill="#ffffff"
        stroke="#000437"
        strokeWidth="4"
      />
      <circle
        cx="204"
        cy="42"
        r="9"
        fill="#ffffff"
        stroke="#000437"
        strokeWidth="4"
      />
      <circle
        cx="224"
        cy="22"
        r="12"
        fill="#ffffff"
        stroke="#000437"
        strokeWidth="4"
      />
    </svg>
  );
}
