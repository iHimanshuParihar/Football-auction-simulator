import { NextRequest } from 'next/server';

export interface ClubAssetUrls {
  badgeUrl: string | null;
  jerseyUrl: string | null;
}

const CLUB_QUERY_ALIASES: Record<string, string> = {
  psg: 'Paris SG',
  'paris saint-germain': 'Paris SG',
  'inter milan': 'Inter',
  'fc barcelona': 'Barcelona',
  'atlético madrid': 'Atletico Madrid',
  'atletico madrid': 'Atletico Madrid',
  'fc porto': 'Porto',
  benfica: 'Benfica',
  'afc ajax': 'Ajax',
  'sporting cp': 'Sporting Lisbon',
  'psv eindhoven': 'PSV Eindhoven',
  'celtic fc': 'Celtic',
  'bayern munich': 'Bayern Munich',
  'rb leipzig': 'RB Leipzig',
};

const WIKI_CLUB_TITLES: Record<string, string> = {
  'real madrid': 'Real_Madrid_CF',
  'manchester city': 'Manchester_City_F.C.',
  'fc barcelona': 'FC_Barcelona',
  'bayern munich': 'FC_Bayern_Munich',
  arsenal: 'Arsenal_F.C.',
  liverpool: 'Liverpool_F.C.',
  psg: 'Paris_Saint-Germain_F.C.',
  'inter milan': 'Inter_Milan',
  'ac milan': 'AC_Milan',
  juventus: 'Juventus_FC',
  'borussia dortmund': 'Borussia_Dortmund',
  'atlético madrid': 'Atl%C3%A9tico_Madrid',
  chelsea: 'Chelsea_F.C.',
  'manchester united': 'Manchester_United_F.C.',
  tottenham: 'Tottenham_Hotspur_F.C.',
  napoli: 'SSC_Napoli',
  'as roma': 'AS_Roma',
  benfica: 'S.L._Benfica',
  'fc porto': 'FC_Porto',
  'afc ajax': 'Ajax_Amsterdam',
  'aston villa': 'Aston_Villa_F.C.',
  'newcastle united': 'Newcastle_United_F.C.',
  'sporting cp': 'Sporting_CP',
  'psv eindhoven': 'PSV_Eindhoven',
  'celtic fc': 'Celtic_F.C.',
  'rb leipzig': 'RB_Leipzig',
};

const globalAssetCache = globalThis as unknown as {
  __uclClubAssetsCache?: Map<string, ClubAssetUrls>;
};

function getAssetCache(): Map<string, ClubAssetUrls> {
  if (!globalAssetCache.__uclClubAssetsCache) {
    globalAssetCache.__uclClubAssetsCache = new Map();
  }
  return globalAssetCache.__uclClubAssetsCache;
}

async function resolveClubAssets(clubName: string): Promise<ClubAssetUrls> {
  const key = clubName.trim().toLowerCase();
  const cache = getAssetCache();
  if (cache.has(key)) {
    return cache.get(key)!;
  }

  let badgeUrl: string | null = null;
  let jerseyUrl: string | null = null;

  const queryName = CLUB_QUERY_ALIASES[key] ?? clubName.trim();

  try {
    const teamRes = await fetch(
      `https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=${encodeURIComponent(queryName)}`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (teamRes.ok) {
      const teamData = (await teamRes.json()) as {
        teams?: Array<{
          idTeam?: string;
          strSport?: string;
          strBadge?: string;
          strTeamBadge?: string;
          strTeamJersey?: string;
        }>;
      };
      const team =
        teamData.teams?.find((t) => t.strSport === 'Soccer') ??
        teamData.teams?.[0];

      if (team) {
        badgeUrl = team.strBadge || team.strTeamBadge || null;
        jerseyUrl = team.strTeamJersey || null;

        if (!jerseyUrl && team.idTeam) {
          try {
            const equipRes = await fetch(
              `https://www.thesportsdb.com/api/v1/json/123/lookupequipment.php?id=${encodeURIComponent(team.idTeam)}`,
              { signal: AbortSignal.timeout(2500) }
            );
            if (equipRes.ok) {
              const equipData = (await equipRes.json()) as {
                equipment?: Array<{ strEquipment?: string; strType?: string }>;
              };
              const list = equipData.equipment ?? [];
              const firstKit =
                list.filter((e) => e.strType === '1st').slice(-1)[0] ?? list[0];
              jerseyUrl = firstKit?.strEquipment ?? null;
            }
          } catch {
            // ignore equipment timeout
          }
        }
      }
    }
  } catch {
    // ignore offline/timeout
  }

  // Fallback to Wikipedia REST summary emblem thumbnail if badge not resolved
  if (!badgeUrl) {
    try {
      const wikiSlug =
        WIKI_CLUB_TITLES[key] ?? encodeURIComponent(clubName.trim().replace(/\s+/g, '_'));
      const wikiRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiSlug}`,
        {
          headers: { 'User-Agent': 'UCL-Mega-Auction-Simulator/2.0' },
          signal: AbortSignal.timeout(2500),
        }
      );
      if (wikiRes.ok) {
        const wData = (await wikiRes.json()) as {
          type?: string;
          thumbnail?: { source?: string };
        };
        if (wData.type !== 'disambiguation' && wData.thumbnail?.source) {
          badgeUrl = wData.thumbnail.source;
        }
      }
    } catch {
      // ignore offline/timeout
    }
  }

  const resolved = { badgeUrl, jerseyUrl };
  cache.set(key, resolved);
  return resolved;
}

/**
 * Free, open-source official club badge & 1st-team jersey resolver + same-origin proxy
 * so UI badges and Three.js canvas textures never hit cross-origin tainting.
 */
export async function GET(request: NextRequest) {
  const club = request.nextUrl.searchParams.get('club')?.trim();
  if (!club) {
    return Response.json({ badgeUrl: null, jerseyUrl: null });
  }

  const assets = await resolveClubAssets(club);
  const proxyKind = request.nextUrl.searchParams.get('proxy');

  if (proxyKind === 'badge' || proxyKind === 'jersey') {
    const targetUrl = proxyKind === 'badge' ? assets.badgeUrl : assets.jerseyUrl;
    if (!targetUrl) {
      return new Response(null, { status: 404 });
    }
    try {
      const upstream = await fetch(targetUrl, { signal: AbortSignal.timeout(3500) });
      if (!upstream.ok) return new Response(null, { status: 404 });
      const contentType = upstream.headers.get('content-type') || 'image/png';
      const bytes = await upstream.arrayBuffer();
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  }

  return Response.json(assets);
}
