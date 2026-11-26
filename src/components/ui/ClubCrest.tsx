'use client';

import React, { useEffect, useState } from 'react';
import { ClubPreset } from '@/types/game';
import { fetchClubAssets, getCachedClubAssets } from '@/lib/club-assets-client';

interface ClubCrestProps {
  club: ClubPreset;
  size?: number;
  className?: string;
}

export const ClubCrest: React.FC<ClubCrestProps> = ({
  club,
  size = 44,
  className = '',
}) => {
  const { primary, secondary, accent, crestShape, crestMotif, code, name } = club;
  const [badgeState, setBadgeState] = useState<{
    clubName: string;
    url: string | null;
    failed: boolean;
  }>(() => ({
    clubName: name,
    url: getCachedClubAssets(name)?.badgeUrl ?? null,
    failed: false,
  }));

  useEffect(() => {
    let cancelled = false;
    fetchClubAssets(name).then((assets) => {
      if (!cancelled) {
        setBadgeState({
          clubName: name,
          url: assets.badgeUrl,
          failed: false,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  const activeBadgeUrl =
    badgeState.clubName === name && badgeState.url && !badgeState.failed
      ? badgeState.url
      : null;

  if (activeBadgeUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`shrink-0 flex items-center justify-center rounded-lg overflow-hidden drop-shadow-md ${className}`}
        title={name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeBadgeUrl}
          width={size}
          height={size}
          alt={`${name} official logo`}
          onError={() =>
            setBadgeState((prev) => ({ ...prev, failed: true }))
          }
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`shrink-0 drop-shadow-md ${className}`}
      aria-label={`${name} crest`}
    >
      {crestShape === 'circle' && (
        <>
          <circle cx="32" cy="32" r="28" fill={primary} stroke={accent} strokeWidth="3.5" />
          <circle cx="32" cy="32" r="21" fill={secondary} opacity="0.92" />
        </>
      )}
      {crestShape === 'shield' && (
        <path
          d="M12 10 H52 V32 C52 46 32 56 32 56 C32 56 12 46 12 32 Z"
          fill={primary}
          stroke={accent}
          strokeWidth="3.5"
        />
      )}
      {crestShape === 'crest' && (
        <path
          d="M14 12 Q32 6 50 12 L48 36 Q32 58 32 58 Q32 58 16 36 Z"
          fill={primary}
          stroke={accent}
          strokeWidth="3.5"
        />
      )}
      {crestShape === 'diamond' && (
        <polygon
          points="32,5 58,32 32,59 6,32"
          fill={primary}
          stroke={accent}
          strokeWidth="3.5"
        />
      )}

      {/* Motif */}
      {crestMotif === 'crown' && (
        <path
          d="M22 22 L26 14 L32 19 L38 14 L42 22 Z"
          fill={accent}
        />
      )}
      {crestMotif === 'star' && (
        <polygon
          points="32,12 34.8,18.5 42,19 36.5,23.5 38.2,30 32,26.2 25.8,30 27.5,23.5 22,19 29.2,18.5"
          fill={accent}
        />
      )}
      {crestMotif === 'stripes' && (
        <g opacity="0.35">
          <rect x="22" y="14" width="5" height="34" fill={secondary} />
          <rect x="37" y="14" width="5" height="34" fill={secondary} />
        </g>
      )}
      {crestMotif === 'cross' && (
        <g opacity="0.5">
          <rect x="30" y="12" width="4" height="36" fill={accent} />
          <rect x="16" y="25" width="32" height="4" fill={accent} />
        </g>
      )}
      {crestMotif === 'wings' && (
        <path
          d="M18 22 Q25 14 32 22 Q39 14 46 22 Q39 24 32 28 Q25 24 18 22 Z"
          fill={accent}
          opacity="0.85"
        />
      )}
      {crestMotif === 'anchor' && (
        <circle cx="32" cy="18" r="4" fill="none" stroke={accent} strokeWidth="2.5" />
      )}

      {/* Code Pill */}
      <rect x="15" y="34" width="34" height="14" rx="4" fill="rgba(2,6,23,0.82)" />
      <text
        x="32"
        y="44"
        textAnchor="middle"
        fill="#f8fafc"
        fontSize="10"
        fontWeight="900"
        fontFamily="sans-serif"
      >
        {code}
      </text>
    </svg>
  );
};
