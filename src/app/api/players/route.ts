import { NextRequest } from 'next/server';
import { CURATED_PLAYERS, filterPlayersByEra } from '@/data/players';
import { EraPoolFilter } from '@/types/game';

/**
 * Serves the curated 82+ player pool offline with 0ms latency,
 * and supports optional free open-source Wikidata SPARQL / TheSportsDB lookup
 * when `?enrich=1&q=<name>` is explicitly requested.
 */
export async function GET(request: NextRequest) {
  const era = (request.nextUrl.searchParams.get('era') ?? 'mixed') as EraPoolFilter;
  const query = request.nextUrl.searchParams.get('q')?.trim();
  const enrich = request.nextUrl.searchParams.get('enrich') === '1';

  let externalInfo: {
    source: string;
    playerName: string;
    nationality?: string;
    thumb?: string;
    description?: string;
  } | null = null;

  if (enrich && query) {
    try {
      // Free, keyless open-source TheSportsDB public demo endpoint
      const res = await fetch(
        `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          player?: Array<{
            strPlayer?: string;
            strNationality?: string;
            strThumb?: string;
            strDescriptionEN?: string;
          }>;
        };
        const match = data.player?.[0];
        if (match?.strPlayer) {
          externalInfo = {
            source: 'TheSportsDB (Open API)',
            playerName: match.strPlayer,
            nationality: match.strNationality,
            thumb: match.strThumb,
            description: match.strDescriptionEN?.slice(0, 220),
          };
        }
      }
    } catch {
      // Graceful offline fallback
      externalInfo = null;
    }
  }

  const players = filterPlayersByEra(era);
  return Response.json({
    count: players.length,
    totalCatalog: CURATED_PLAYERS.length,
    era,
    players,
    externalInfo,
  });
}
