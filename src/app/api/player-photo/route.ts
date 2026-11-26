import { NextRequest } from 'next/server';

const globalCache = globalThis as unknown as {
  __uclPhotoCache?: Map<string, string | null>;
};

function getCache(): Map<string, string | null> {
  if (!globalCache.__uclPhotoCache) {
    globalCache.__uclPhotoCache = new Map();
  }
  return globalCache.__uclPhotoCache;
}

/**
 * Free, keyless open-source player portrait resolver using Wikipedia REST Summary
 * and TheSportsDB public demo API, with server-side caching and graceful null fallback.
 */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name')?.trim();
  if (!name || name.includes('Youth')) {
    return Response.json({ url: null });
  }

  const cache = getCache();
  const key = name.toLowerCase();
  if (cache.has(key)) {
    return Response.json({ url: cache.get(key) ?? null });
  }

  let resolvedUrl: string | null = null;

  // 1. Try free open-source TheSportsDB cutout/thumb first (specifically football portraits)
  try {
    const sdb = await fetch(
      `https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (sdb.ok) {
      const data = (await sdb.json()) as {
        player?: Array<{ strCutout?: string; strThumb?: string; strSport?: string }>;
      };
      const soccerMatch =
        data.player?.find((p) => p.strSport === 'Soccer') ?? data.player?.[0];
      if (soccerMatch?.strCutout || soccerMatch?.strThumb) {
        resolvedUrl = soccerMatch.strCutout || soccerMatch.strThumb || null;
      }
    }
  } catch {
    // ignore offline/timeout
  }

  // 2. Fallback to Wikipedia REST Summary thumbnail (free & open-source Wikimedia Commons)
  if (!resolvedUrl) {
    try {
      const wikiTitle = encodeURIComponent(name.replace(/\s+/g, '_'));
      const wiki = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`,
        {
          headers: { 'User-Agent': 'UCL-Mega-Auction-Simulator/2.0' },
          signal: AbortSignal.timeout(2500),
        }
      );
      if (wiki.ok) {
        const data = (await wiki.json()) as {
          type?: string;
          thumbnail?: { source?: string };
        };
        if (data.type !== 'disambiguation' && data.thumbnail?.source) {
          resolvedUrl = data.thumbnail.source;
        }
      }
    } catch {
      // ignore offline/timeout
    }
  }

  cache.set(key, resolvedUrl);
  return Response.json({ url: resolvedUrl });
}
