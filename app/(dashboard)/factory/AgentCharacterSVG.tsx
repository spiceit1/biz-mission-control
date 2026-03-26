"use client";

// Parametric Mii-style SVG character generator
// Props: shirtColor, emoji, skinColor, hairColor, hairStyle, pose (sitting/standing)

interface AgentCharacterProps {
  shirtColor: string;
  emoji: string;
  skinColor?: string;
  hairColor?: string;
  hairStyle?: "redspiky" | "none" | "short" | "long" | "bun";
  pose: "sitting" | "standing";
  size?: number;
  bounce?: boolean;
}

export default function AgentCharacterSVG({
  shirtColor,
  emoji,
  skinColor = "#d4a574",
  hairColor = "#4a3520",
  hairStyle = "short",
  pose,
  size = 80,
  bounce = false,
}: AgentCharacterProps) {
  const scale = size / 80;
  const isSitting = pose === "sitting";

  // Lighter version of shirt color for highlights
  const shirtHighlight = shirtColor + "80";

  return (
    <div
      style={{
        width: size,
        height: size * 1.5,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: bounce ? "agentBounce 1s ease-in-out infinite" : "none",
      }}
    >
      <svg
        viewBox={isSitting ? "0 0 80 120" : "0 0 80 110"}
        width={size}
        height={isSitting ? size * 1.5 : size * 1.375}
        xmlns="http://www.w3.org/2000/svg"
      >
        {isSitting && (
          <>
            {/* Chair back */}
            <rect x="17" y="52" width="6" height="30" rx="3" fill="#5a4e38" />
            <rect x="57" y="52" width="6" height="30" rx="3" fill="#5a4e38" />
            {/* Chair seat */}
            <rect x="14" y="78" width="52" height="7" rx="3" fill="#6a5e48" />
            {/* Chair legs */}
            <rect x="16" y="85" width="5" height="16" rx="2" fill="#4a3e28" />
            <rect x="59" y="85" width="5" height="16" rx="2" fill="#4a3e28" />
          </>
        )}

        {/* === BODY === */}
        <g transform={isSitting ? "translate(0, 2)" : "translate(0, 0)"}>
          {/* Legs */}
          {isSitting ? (
            <>
              {/* Sitting legs - bent */}
              <rect x="26" y="68" width="12" height="14" rx="5" fill="#3a3a50" />
              <rect x="42" y="68" width="12" height="14" rx="5" fill="#3a3a50" />
              {/* Shoes */}
              <ellipse cx="32" cy="82" rx="8" ry="4" fill="#2a2a3a" />
              <ellipse cx="48" cy="82" rx="8" ry="4" fill="#2a2a3a" />
            </>
          ) : (
            <>
              {/* Standing legs */}
              <rect x="27" y="68" width="11" height="22" rx="5" fill="#3a3a50" />
              <rect x="42" y="68" width="11" height="22" rx="5" fill="#3a3a50" />
              {/* Shoes */}
              <ellipse cx="32" cy="91" rx="8" ry="5" fill="#2a2a3a" />
              <ellipse cx="48" cy="91" rx="8" ry="5" fill="#2a2a3a" />
            </>
          )}

          {/* Shirt / Torso */}
          <rect x="22" y="42" width="36" height="28" rx="8" fill={shirtColor} />
          {/* Shirt highlight */}
          <rect x="22" y="42" width="36" height="12" rx="8" fill="white" opacity="0.08" />

          {/* Arms */}
          <rect x="14" y="46" width="11" height="20" rx="5.5" fill={shirtColor} />
          <rect x="55" y="46" width="11" height="20" rx="5.5" fill={shirtColor} />

          {/* Hands */}
          <circle cx="19" cy="66" r="5.5" fill={skinColor} />
          <circle cx="61" cy="66" r="5.5" fill={skinColor} />

          {/* Emoji on shirt */}
          <text x="40" y="62" textAnchor="middle" fontSize="14" dominantBaseline="middle">
            {emoji}
          </text>

          {/* Neck */}
          <rect x="34" y="32" width="12" height="12" rx="4" fill={skinColor} />

          {/* Head */}
          <circle cx="40" cy="22" r="17" fill={skinColor} />

          {/* Hair */}
          {hairStyle === "redspiky" && (
            <>
              <ellipse cx="40" cy="10" rx="17" ry="9" fill={hairColor} />
              <ellipse cx="40" cy="13" rx="15" ry="5" fill={hairColor} opacity="0.8" />
              <ellipse cx="28" cy="15" rx="5" ry="7" fill={hairColor} />
              <ellipse cx="52" cy="15" rx="5" ry="7" fill={hairColor} />
              {/* Spiky bits */}
              <ellipse cx="33" cy="7" rx="3" ry="5" fill={hairColor} transform="rotate(-15 33 7)" />
              <ellipse cx="47" cy="7" rx="3" ry="5" fill={hairColor} transform="rotate(15 47 7)" />
            </>
          )}
          {hairStyle === "short" && (
            <>
              <ellipse cx="40" cy="11" rx="16" ry="8" fill={hairColor} />
              <ellipse cx="28" cy="16" rx="4" ry="6" fill={hairColor} />
              <ellipse cx="52" cy="16" rx="4" ry="6" fill={hairColor} />
            </>
          )}
          {hairStyle === "long" && (
            <>
              <ellipse cx="40" cy="10" rx="18" ry="9" fill={hairColor} />
              <rect x="22" y="14" width="8" height="20" rx="4" fill={hairColor} />
              <rect x="50" y="14" width="8" height="20" rx="4" fill={hairColor} />
            </>
          )}
          {hairStyle === "bun" && (
            <>
              <ellipse cx="40" cy="11" rx="16" ry="8" fill={hairColor} />
              <circle cx="40" cy="4" r="6" fill={hairColor} />
            </>
          )}

          {/* Eyes */}
          <ellipse cx="33" cy="22" rx="3.5" ry="4" fill="white" />
          <ellipse cx="47" cy="22" rx="3.5" ry="4" fill="white" />
          <circle cx="34" cy="22.5" r="2.2" fill="#2a2a3a" />
          <circle cx="48" cy="22.5" r="2.2" fill="#2a2a3a" />
          {/* Eye shine */}
          <circle cx="34.7" cy="21.5" r="0.8" fill="white" />
          <circle cx="48.7" cy="21.5" r="0.8" fill="white" />

          {/* Eyebrows */}
          <line x1="30" y1="17" x2="36" y2="16.5" stroke={hairColor === "#4a3520" ? "#3a2a15" : hairColor} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="44" y1="16.5" x2="50" y2="17" stroke={hairColor === "#4a3520" ? "#3a2a15" : hairColor} strokeWidth="1.5" strokeLinecap="round" />

          {/* Mouth */}
          <path d="M 35 29 Q 40 33 45 29" stroke="#c4956a" strokeWidth="1.5" fill="none" strokeLinecap="round" />

          {/* Blush */}
          <ellipse cx="28" cy="26" rx="4" ry="2.5" fill="#ff9999" opacity="0.2" />
          <ellipse cx="52" cy="26" rx="4" ry="2.5" fill="#ff9999" opacity="0.2" />
        </g>
      </svg>
    </div>
  );
}
