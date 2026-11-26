'use client';

import React, { useEffect, useState } from 'react';
import { ClubPreset } from '@/types/game';
import { fetchClubAssets, getCachedClubAssets } from '@/lib/club-assets-client';

interface JerseyPreviewProps {
  club: ClubPreset;
  size?: number;
  number?: number;
  playerName?: string;
}

export const JerseyPreview: React.FC<JerseyPreviewProps> = ({
  club,
  size = 64,
  number = 10,
  playerName,
}) => {
  const [kitState, setKitState] = useState<{
    clubName: string;
    url: string | null;
    failed: boolean;
  }>(() => ({
    clubName: club.name,
    url: getCachedClubAssets(club.name)?.jerseyUrl ?? null,
    failed: false,
  }));

  useEffect(() => {
    let cancelled = false;
    fetchClubAssets(club.name).then((assets) => {
      if (!cancelled) {
        setKitState({
          clubName: club.name,
          url: assets.jerseyUrl,
          failed: false,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [club.name]);

  const activeJerseyUrl =
    kitState.clubName === club.name && kitState.url && !kitState.failed
      ? kitState.url
      : null;

  const clipId = `jersey_${club.id}_${size}_${number}_${playerName ?? 'x'}`;
  const lastName = playerName
    ? playerName.split(' ').slice(-1)[0].toUpperCase().slice(0, 10)
    : null;

  if (activeJerseyUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="relative shrink-0 drop-shadow-lg flex items-center justify-center"
        title={`${club.name} Official Kit #${number}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeJerseyUrl}
          width={size}
          height={size}
          alt={`${club.name} official jersey`}
          onError={() => setKitState((prev) => ({ ...prev, failed: true }))}
          className="w-full h-full object-contain"
        />
        <span className="absolute bottom-0 right-0 px-1 py-0.2 rounded bg-slate-950/90 border border-cyan-400/50 text-[9px] font-black text-white leading-tight">
          #{number}
        </span>
      </div>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className="drop-shadow-lg shrink-0">
      <defs>
        <clipPath id={clipId}>
          <path d="M24 10 L32 14 Q40 18 48 14 L56 10 L70 22 L63 34 L56 29 L56 70 L24 70 L24 29 L17 34 L10 22 Z" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="80" height="80" fill={club.primary} />
        {club.pattern === 'stripes' && (
          <g fill={club.secondary}>
            <rect x="24" y="0" width="6" height="80" />
            <rect x="37" y="0" width="6" height="80" />
            <rect x="50" y="0" width="6" height="80" />
          </g>
        )}
        {club.pattern === 'hoops' && (
          <g fill={club.secondary}>
            <rect x="0" y="18" width="80" height="8" />
            <rect x="0" y="34" width="80" height="8" />
            <rect x="0" y="50" width="80" height="8" />
          </g>
        )}
        {club.pattern === 'sash' && (
          <polygon points="18,10 30,10 62,70 50,70" fill={club.secondary} />
        )}
        {club.pattern === 'center' && (
          <rect x="33" y="0" width="14" height="80" fill={club.secondary} />
        )}
        {club.pattern === 'sleeves' && (
          <g fill={club.secondary}>
            <rect x="0" y="0" width="24" height="40" />
            <rect x="56" y="0" width="24" height="40" />
          </g>
        )}
      </g>

      <path
        d="M24 10 L32 14 Q40 18 48 14 L56 10 L70 22 L63 34 L56 29 L56 70 L24 70 L24 29 L17 34 L10 22 Z"
        fill="none"
        stroke={club.accent}
        strokeWidth="2.4"
      />

      {/* Mini crest badge on left chest */}
      <circle cx="48" cy="27" r="4" fill={club.secondary} stroke={club.accent} strokeWidth="1.2" />

      {lastName && (
        <text
          x="40"
          y="36"
          textAnchor="middle"
          fill="#ffffff"
          stroke="#020617"
          strokeWidth="1.8"
          paintOrder="stroke"
          fontSize="6.5"
          fontWeight="900"
        >
          {lastName}
        </text>
      )}
      <text
        x="40"
        y={lastName ? '56' : '50'}
        textAnchor="middle"
        fill="#ffffff"
        stroke="#020617"
        strokeWidth="2.6"
        paintOrder="stroke"
        fontSize={lastName ? '19' : '17'}
        fontWeight="900"
      >
        {number}
      </text>
    </svg>
  );
};
