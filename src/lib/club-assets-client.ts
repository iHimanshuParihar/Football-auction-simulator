'use client';

export interface ClubAssetUrls {
  badgeUrl: string | null;
  jerseyUrl: string | null;
}

const clientClubCache = new Map<string, ClubAssetUrls>();
const clientPending = new Map<string, Promise<ClubAssetUrls>>();

export function getCachedClubAssets(clubName: string): ClubAssetUrls | null {
  return clientClubCache.get(clubName.trim().toLowerCase()) ?? null;
}

export function fetchClubAssets(clubName: string): Promise<ClubAssetUrls> {
  const key = clubName.trim().toLowerCase();
  if (clientClubCache.has(key)) {
    return Promise.resolve(clientClubCache.get(key)!);
  }
  if (clientPending.has(key)) {
    return clientPending.get(key)!;
  }

  const req = fetch(`/api/club-assets?club=${encodeURIComponent(clubName)}`)
    .then((res) => (res.ok ? res.json() : { badgeUrl: null, jerseyUrl: null }))
    .then((data: Partial<ClubAssetUrls>) => {
      const resolved: ClubAssetUrls = {
        badgeUrl: data.badgeUrl ?? null,
        jerseyUrl: data.jerseyUrl ?? null,
      };
      clientClubCache.set(key, resolved);
      clientPending.delete(key);
      return resolved;
    })
    .catch(() => {
      const fallback = { badgeUrl: null, jerseyUrl: null };
      clientClubCache.set(key, fallback);
      clientPending.delete(key);
      return fallback;
    });

  clientPending.set(key, req);
  return req;
}

export async function loadSameOriginClubImage(
  clubName: string,
  kind: 'badge' | 'jersey'
): Promise<HTMLImageElement | null> {
  const assets = await fetchClubAssets(clubName);
  const rawUrl = kind === 'badge' ? assets.badgeUrl : assets.jerseyUrl;
  if (!rawUrl) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `/api/club-assets?club=${encodeURIComponent(clubName)}&proxy=${kind}`;
  });
}
