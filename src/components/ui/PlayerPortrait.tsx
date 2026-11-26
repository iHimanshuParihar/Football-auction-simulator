'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Player } from '@/types/game';
import { buildPlayerPortraitSvg } from '@/lib/svg-generators';

interface PlayerPortraitProps {
  player: Player;
  kitColor?: string;
  size?: number;
  className?: string;
  preferRealPhoto?: boolean;
}

const clientPhotoCache = new Map<string, string | null>();

export const PlayerPortrait: React.FC<PlayerPortraitProps> = ({
  player,
  kitColor = '#1d4ed8',
  size = 56,
  className = '',
  preferRealPhoto = true,
}) => {
  const [realPhotoUrl, setRealPhotoUrl] = useState<string | null>(() =>
    clientPhotoCache.has(player.name)
      ? (clientPhotoCache.get(player.name) ?? null)
      : null
  );
  const [imgFailed, setImgFailed] = useState(false);

  const svgDataUri = useMemo(() => {
    const svg = buildPlayerPortraitSvg(player, kitColor);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [player, kitColor]);

  useEffect(() => {
    if (!preferRealPhoto || player.era === 'reserve') return;
    if (clientPhotoCache.has(player.name)) {
      const cached = clientPhotoCache.get(player.name) ?? null;
      const t = setTimeout(() => {
        setRealPhotoUrl(cached);
        setImgFailed(false);
      }, 0);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    fetch(`/api/player-photo?name=${encodeURIComponent(player.name)}`)
      .then((r) => (r.ok ? r.json() : { url: null }))
      .then((data: { url?: string | null }) => {
        const url = data.url ?? null;
        clientPhotoCache.set(player.name, url);
        if (!cancelled) {
          setRealPhotoUrl(url);
          setImgFailed(false);
        }
      })
      .catch(() => {
        clientPhotoCache.set(player.name, null);
      });

    return () => {
      cancelled = true;
    };
  }, [player.name, player.era, preferRealPhoto]);

  const activeSrc =
    preferRealPhoto && realPhotoUrl && !imgFailed ? realPhotoUrl : svgDataUri;

  return (
    <div
      style={{ width: size, height: size, borderColor: kitColor }}
      className={`relative rounded-xl overflow-hidden border-2 bg-slate-900 shrink-0 shadow-md ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeSrc}
        width={size}
        height={size}
        alt={player.name}
        onError={() => setImgFailed(true)}
        className="w-full h-full object-cover object-top"
      />
    </div>
  );
};
