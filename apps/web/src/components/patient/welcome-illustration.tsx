export function WelcomeIllustration() {
  return (
    <svg
      viewBox="0 0 540 420"
      role="img"
      aria-label="A patient speaking with a caring healthcare professional"
      className="h-auto w-full"
    >
      <defs>
        <linearGradient id="room" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e8f6f2" />
          <stop offset="1" stopColor="#fef7e7" />
        </linearGradient>
      </defs>
      <rect x="12" y="12" width="516" height="396" rx="48" fill="url(#room)" />
      <circle cx="418" cy="96" r="46" fill="#fff" opacity=".72" />
      <path
        d="M394 96h48M418 72v48"
        stroke="#13876f"
        strokeWidth="5"
        strokeLinecap="round"
        opacity=".65"
      />
      <path
        d="M72 335c66-58 128-70 190-34 71-50 142-36 211 34v35H72z"
        fill="#cbe8df"
      />
      <circle cx="190" cy="176" r="48" fill="#b86f4c" />
      <path
        d="M144 166c7-51 84-68 100-6-34-6-55-24-63-40-5 24-19 39-37 46z"
        fill="#152d43"
      />
      <path d="M117 350c3-91 26-137 74-137 48 0 75 51 78 137z" fill="#f7efe4" />
      <path
        d="M178 226l13 20 14-20"
        fill="none"
        stroke="#eca52e"
        strokeWidth="5"
      />
      <circle cx="352" cy="155" r="43" fill="#9f5d43" />
      <path
        d="M310 151c5-55 81-58 87-4-32-4-54-22-65-38-2 22-9 34-22 42z"
        fill="#102a43"
      />
      <path d="M284 350c5-103 25-154 69-154 48 0 75 55 81 154z" fill="#fff" />
      <path
        d="M331 204l22 29 23-29M353 231v91"
        fill="none"
        stroke="#76a9bf"
        strokeWidth="5"
      />
      <path
        d="M326 263c-22 5-42 22-52 47M381 263c23 5 42 22 52 47"
        fill="none"
        stroke="#0b2748"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle
        cx="353"
        cy="299"
        r="13"
        fill="none"
        stroke="#0b2748"
        strokeWidth="5"
      />
      <path
        d="M232 270c37-18 63-21 91-5"
        fill="none"
        stroke="#b86f4c"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <circle cx="278" cy="260" r="9" fill="#b86f4c" />
      <path
        d="M165 177c9 8 19 8 29 0M335 158c8 7 17 7 25 0"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".8"
      />
      <g fill="#13876f">
        <circle cx="88" cy="92" r="7" />
        <circle cx="111" cy="72" r="5" />
        <circle cx="120" cy="104" r="4" />
      </g>
    </svg>
  );
}
