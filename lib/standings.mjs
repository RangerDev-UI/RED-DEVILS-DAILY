/** Premier League table via ESPN's undocumented public JSON feed. No invented rows. */
export const STANDINGS_SOURCE = 'https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings';
export const STANDINGS_LINK = 'https://www.espn.com/soccer/standings/_/league/eng.1';
const STATS = {
  played: ['gamesPlayed', 'played', 'matchesPlayed'],
  won: ['wins'], drawn: ['ties', 'draws'], lost: ['losses'],
  gf: ['pointsFor', 'goalsFor', 'goalsScored'],
  ga: ['pointsAgainst', 'goalsAgainst', 'goalsConceded'],
  gd: ['pointDifferential', 'goalDifference', 'goalDifferential'],
  points: ['points'], rank: ['rank', 'position']
};
function readStat(stats, names) {
  const found = stats.find(stat => names.includes(stat?.name) || names.includes(stat?.type));
  const raw = found?.value ?? found?.displayValue;
  if (raw === '' || raw == null || !Number.isFinite(Number(raw))) return null;
  return Number(raw);
}
function logoFor(team) {
  const id = String(team?.id || '');
  return /^\d{1,9}$/.test(id) ? `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png` : null;
}
export function seasonStart(now = new Date()) {
  // A European football season begins in July. In November 2026, use season=2026.
  const d = new Date(now);
  return d.getUTCFullYear() - (d.getUTCMonth() < 6 ? 1 : 0);
}
export function normalizeStandings(payload, expectedSeason = seasonStart()) {
  if (Number(payload?.season?.year) !== Number(expectedSeason)) throw new Error('Standings season mismatch');
  const groups = (Array.isArray(payload?.children) ? payload.children : []).map(group => {
    const entries = group?.standings?.entries;
    if (!Array.isArray(entries)) return null;
    const rows = entries.map((entry) => {
      const id = String(entry?.team?.id || '');
      const name = String(entry?.team?.displayName || entry?.team?.name || '').slice(0, 90);
      if (!name || !/^\d{1,9}$/.test(id)) return null;
      const stats = Array.isArray(entry?.stats) ? entry.stats : [];
      const obj = Object.fromEntries(Object.entries(STATS).map(([key, keys]) => [key, readStat(stats, keys)]));
      return { id, name, logo: logoFor(entry.team), ...obj };
    }).filter(Boolean);
    return rows.length ? { name: String(group.name || 'พรีเมียร์ลีก').slice(0, 70), rows } : null;
  }).filter(Boolean);
  if (!groups.length) throw new Error('No valid league table rows');
  return {
    source: 'ESPN', sourceUrl: STANDINGS_LINK,
    season: String(payload?.season?.displayName || `${expectedSeason}-${String(expectedSeason+1).slice(-2)}`).slice(0, 35),
    seasonYear: expectedSeason, groups, updatedAt: new Date().toISOString(), hasData: true
  };
}
export async function loadStandings(fetchFn = fetch, now = new Date()) {
  const year = seasonStart(now);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9500);
  try {
    const response = await fetchFn(`${STANDINGS_SOURCE}?season=${year}`, {
      signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'RedDevilsDaily/1.2 (league standings reader)' }
    });
    if (!response.ok) throw new Error(`Standings upstream HTTP ${response.status}`);
    return normalizeStandings(await response.json(), year);
  } finally { clearTimeout(timeout); }
}
