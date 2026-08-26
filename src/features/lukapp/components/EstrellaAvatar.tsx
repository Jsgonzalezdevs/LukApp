import React from 'react';

interface EstrellaAvatarProps {
  className?: string;
  size?: number;
  emotion?: 'happy' | 'thinking' | 'surprised' | 'sad';
  armRotation?: { left: number; right: number };
  legRotation?: { left: number; right: number };
  headTilt?: number;
}

export const EstrellaAvatar: React.FC<EstrellaAvatarProps> = ({
  className = '',
  size = 200,
  emotion = 'happy',
  armRotation = { left: -30, right: 30 },
  legRotation = { left: 0, right: 0 },
  headTilt = 0,
}) => {
  const viewBox = `0 0 ${size} ${size}`;
  const scale = size / 200;

  const mouthPaths = {
    happy: 'M 90 110 Q 100 115 110 110',
    thinking: 'M 85 110 Q 100 105 115 110',
    surprised: 'M 95 110 Q 100 115 105 110 M 95 110 Q 100 115 105 110',
    sad: 'M 90 115 Q 100 110 110 115',
  };

  const eyeStates = {
    happy: { pupilOffset: 2, scale: 1 },
    thinking: { pupilOffset: -2, scale: 1 },
    surprised: { pupilOffset: 0, scale: 1.2 },
    sad: { pupilOffset: 2, scale: 1 },
  };

  const eyeState = eyeStates[emotion];

  return (
    <svg
      viewBox={viewBox}
      className={className}
      style={{
        width: size,
        height: size,
        overflow: 'visible',
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2" />
        </filter>
      </defs>

      {/* Brazo izquierdo */}
      <g
        style={{
          transformOrigin: `${60 * scale}px ${50 * scale}px`,
          transform: `rotate(${armRotation.left}deg)`,
          transformBox: 'fill-box',
          transition: 'transform 0.3s ease-out',
        }}
      >
        <rect
          x={20 * scale}
          y={45 * scale}
          width={50 * scale}
          height={16 * scale}
          rx={8 * scale}
          fill="#3d1d5c"
          filter="url(#shadow)"
        />
      </g>

      {/* Brazo derecho */}
      <g
        style={{
          transformOrigin: `${140 * scale}px ${50 * scale}px`,
          transform: `rotate(${armRotation.right}deg)`,
          transformBox: 'fill-box',
          transition: 'transform 0.3s ease-out',
        }}
      >
        <rect
          x={130 * scale}
          y={45 * scale}
          width={50 * scale}
          height={16 * scale}
          rx={8 * scale}
          fill="#3d1d5c"
          filter="url(#shadow)"
        />
      </g>

      {/* Cabeza (estrella) */}
      <g
        style={{
          transform: `rotate(${headTilt}deg)`,
          transformBox: 'fill-box',
          transformOrigin: `${100 * scale}px ${80 * scale}px`,
          transition: 'transform 0.3s ease-out',
        }}
      >
        {/* Cuerpo de la estrella */}
        <path
          d={`
            M ${100 * scale} ${10 * scale}
            L ${130 * scale} ${40 * scale}
            L ${160 * scale} ${40 * scale}
            L ${138 * scale} ${60 * scale}
            L ${150 * scale} ${95 * scale}
            L ${115 * scale} ${75 * scale}
            L ${100 * scale} ${105 * scale}
            L ${85 * scale} ${75 * scale}
            L ${50 * scale} ${95 * scale}
            L ${62 * scale} ${60 * scale}
            L ${40 * scale} ${40 * scale}
            L ${70 * scale} ${40 * scale}
            Z
          `}
          fill="#7c3aed"
          filter="url(#shadow)"
        />

        {/* Ojo izquierdo - fondo blanco */}
        <circle cx={78 * scale} cy={60 * scale} r={15 * scale} fill="white" />

        {/* Ojo izquierdo - pupila */}
        <circle
          cx={(78 + eyeState.pupilOffset) * scale}
          cy={60 * scale}
          r={(8 * (eyeState.scale || 1)) * scale}
          fill="black"
          style={{
            transition: 'all 0.2s ease-out',
          }}
        />

        {/* Ojo derecho - fondo blanco */}
        <circle cx={122 * scale} cy={60 * scale} r={15 * scale} fill="white" />

        {/* Ojo derecho - pupila */}
        <circle
          cx={(122 + eyeState.pupilOffset) * scale}
          cy={60 * scale}
          r={(8 * (eyeState.scale || 1)) * scale}
          fill="black"
          style={{
            transition: 'all 0.2s ease-out',
          }}
        />

        {/* Boca */}
        <path
          d={mouthPaths[emotion]}
          stroke="black"
          strokeWidth={4 * scale}
          fill="none"
          strokeLinecap="round"
          style={{
            transition: 'all 0.2s ease-out',
          }}
        />
      </g>

      {/* Pierna izquierda */}
      <g
        style={{
          transformOrigin: `${85 * scale}px ${115 * scale}px`,
          transform: `rotate(${legRotation.left}deg)`,
          transformBox: 'fill-box',
          transition: 'transform 0.3s ease-out',
        }}
      >
        <rect
          x={80 * scale}
          y={115 * scale}
          width={12 * scale}
          height={50 * scale}
          rx={6 * scale}
          fill="#3d1d5c"
          filter="url(#shadow)"
        />
      </g>

      {/* Pierna derecha */}
      <g
        style={{
          transformOrigin: `${115 * scale}px ${115 * scale}px`,
          transform: `rotate(${legRotation.right}deg)`,
          transformBox: 'fill-box',
          transition: 'transform 0.3s ease-out',
        }}
      >
        <rect
          x={108 * scale}
          y={115 * scale}
          width={12 * scale}
          height={50 * scale}
          rx={6 * scale}
          fill="#3d1d5c"
          filter="url(#shadow)"
        />
      </g>
    </svg>
  );
};
