/** Decorative illustrations in the MockView palette. All are aria-hidden: they carry no information. */
const N = "#0B1F3B", S = "#376A90", B = "#8FB6D9", A = "#F4C992", C = "#F8F4EC";

export function InterviewScene({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 360 240" className={className} fill="none">
      <rect x="10" y="20" width="340" height="190" rx="18" fill={N} opacity=".92" />
      <rect x="10" y="20" width="340" height="190" rx="18" stroke={B} strokeOpacity=".5" />
      {/* light cone from the brand mark */}
      <path d="M180 20 L110 210 H250 Z" fill={A} opacity=".12" />
      {/* interviewer window */}
      <rect x="34" y="44" width="130" height="92" rx="10" fill={S} />
      <circle cx="99" cy="80" r="17" fill={C} /><path d="M66 136c2-22 16-32 33-32s31 10 33 32z" fill={C} />
      <rect x="40" y="120" width="34" height="9" rx="4.5" fill={A} />
      {/* you window */}
      <rect x="196" y="44" width="130" height="92" rx="10" fill={N} stroke={B} strokeOpacity=".6" />
      <circle cx="261" cy="80" r="17" fill={B} /><path d="M228 136c2-22 16-32 33-32s31 10 33 32z" fill={B} />
      {/* spoken waveform */}
      {Array.from({ length: 27 }).map((_, i) => {
        const h = 6 + Math.abs(Math.sin(i * 0.7) * 26) + (i % 4) * 2;
        return <rect key={i} x={34 + i * 11} y={174 - h / 2} width="5" height={h} rx="2.5" fill={i < 14 ? A : B} opacity={i < 14 ? 1 : 0.7} />;
      })}
      <circle cx="180" cy="158" r="0" />
      <rect x="150" y="196" width="60" height="6" rx="3" fill={B} opacity=".5" />
    </svg>
  );
}

export function ScoreChart({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 240 160" className={className} fill="none">
      <rect x="4" y="4" width="232" height="152" rx="14" fill="#fff" stroke="#E4DCCB" />
      {[40, 70, 100, 130].map((y) => <line key={y} x1="20" x2="220" y1={y} y2={y} stroke="#EFE9DC" />)}
      <path d="M24 122 C60 110 74 96 100 90 S150 70 176 56 S206 40 218 34" stroke={S} strokeWidth="3.5" strokeLinecap="round" />
      {[[24, 122], [100, 90], [176, 56], [218, 34]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="5" fill={A} stroke={N} strokeWidth="2" />)}
      <rect x="22" y="16" width="56" height="8" rx="4" fill={N} opacity=".85" />
    </svg>
  );
}

export function KeyArt({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 240 160" className={className} fill="none">
      <rect x="4" y="4" width="232" height="152" rx="14" fill={N} />
      <circle cx="84" cy="80" r="34" fill={A} /><circle cx="84" cy="80" r="14" fill={N} />
      <rect x="112" y="72" width="96" height="16" rx="8" fill={A} />
      <rect x="170" y="88" width="12" height="20" rx="3" fill={A} /><rect x="192" y="88" width="12" height="14" rx="3" fill={A} />
      <path d="M30 30h40M170 130h40" stroke={B} strokeWidth="4" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

export function MicArt({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 240 160" className={className} fill="none">
      <rect x="4" y="4" width="232" height="152" rx="14" fill={B} opacity=".35" />
      <rect x="100" y="28" width="40" height="70" rx="20" fill={N} />
      <path d="M82 80c0 26 16 40 38 40s38-14 38-40M120 120v18M96 138h48" stroke={N} strokeWidth="6" strokeLinecap="round" />
      <path d="M48 70c-6 10-6 24 0 34M192 70c6 10 6 24 0 34M32 58c-12 18-12 42 0 60M208 58c12 18 12 42 0 60" stroke={S} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function Dots({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 120 120" className={className} fill={B}>
      {Array.from({ length: 36 }).map((_, i) => <circle key={i} cx={10 + (i % 6) * 20} cy={10 + Math.floor(i / 6) * 20} r="2.5" />)}
    </svg>
  );
}
