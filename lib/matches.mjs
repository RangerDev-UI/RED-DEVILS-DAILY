/**
 * Read-only schedule adapter for ESPN's public (undocumented) soccer endpoint.
 * Never invent scores, dates, results, or opponents. Fail visibly if the source changes.
 */
export const TEAM_ID = '360';
export const COMPETITIONS = [
  { slug: 'eng.1', label: 'พรีเมียร์ลีก' },
  { slug: 'eng.fa', label: 'เอฟเอ คัพ' },
  { slug: 'eng.league_cup', label: 'ลีกคัพ' },
  { slug: 'uefa.champions', label: 'แชมเปียนส์ลีก' },
  { slug: 'uefa.europa', label: 'ยูโรปาลีก' }
];
const SOURCE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
// Older league-specific feeds can return results but omit upcoming fixtures.
const FIXTURE_FALLBACK_URLS = [
  'https://site.web.api.espn.com/apis/site/v2/sports/soccer/all/teams/360/schedule?fixture=true',
  'https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/360/schedule?fixture=true'
];
const LINK = 'https://www.espn.com/soccer/team/fixtures/_/id/360';

// Accept only ESPN's team crest CDN. Never pass through arbitrary image URLs.
function teamLogo(team) {
  const candidates = [team?.logo, team?.logo?.href, ...(Array.isArray(team?.logos) ? team.logos.map(logo => logo?.href || logo) : [])];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === 'https:' && url.hostname === 'a.espncdn.com' &&
          /^\/i\/teamlogos\/soccer\/(?:500|100)\/\d{1,9}\.png$/.test(url.pathname)) return url.href;
    } catch { /* invalid URL */ }
  }
  const id = String(team?.id ?? '');
  return /^\d{1,9}$/.test(id) ? `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png` : null;
}

const validTime = value => {
  const number = new Date(value).getTime();
  return Number.isFinite(number) ? new Date(number).toISOString() : null;
};

function scoreOf(competitor) {
  const raw = competitor?.score;
  const value = typeof raw === 'object' && raw !== null
    ? (raw.displayValue ?? raw.value) : raw;
  return value === '' || value === null || value === undefined || !Number.isFinite(Number(value))
    ? null : String(value);
}

function getStatus(event, contest) {
  const type = contest?.status?.type || event?.status?.type || {};
  const state = String(type.state || '').toLowerCase();
  if (state === 'in') return 'live';
  if (state === 'post' || type.completed === true) return 'finished';
  if (state === 'pre' || state === 'scheduled') return 'scheduled';
  return 'unknown';
}

export function normalizeMatch(event, competition) {
  const contest = event?.competitions?.[0];
  const teams = contest?.competitors;
  if (!Array.isArray(teams) || teams.length !== 2) return null;
  // Cross-competition feeds may put the team ID directly on each competitor.
  const ours = teams.find(item => String(item?.team?.id ?? item?.id ?? '') === TEAM_ID);
  if (!ours) return null;
  const theirs = teams.find(item => item !== ours);
  const date = validTime(event.date || contest?.date);
  const id = String(event.id || '');
  if (!date || !/^\d{5,20}$/.test(id)) return null;
  const status = getStatus(event, contest);
  const isHome = ours.homeAway === 'home';
  if (ours.homeAway !== 'home' && ours.homeAway !== 'away') return null;
  const rivalName = String(theirs?.team?.displayName || theirs?.team?.name || '').trim();
  if (!rivalName) return null;
  return {
    id,
    date,
    competition: String(event?.league?.displayName || event?.league?.name || competition.label).slice(0, 70),
    competitionSlug: String(event?.league?.slug || competition.slug).slice(0, 50),
    opponent: rivalName.slice(0, 100),
    home: isHome,
    logoUnited: teamLogo(ours.team),
    logoOpponent: teamLogo(theirs.team),
    venue: String(contest?.venue?.fullName || '').slice(0, 110),
    status,
    scoreUnited: status === 'scheduled' || status === 'unknown' ? null : scoreOf(ours),
    scoreOpponent: status === 'scheduled' || status === 'unknown' ? null : scoreOf(theirs),
    detail: String(contest?.status?.type?.shortDetail || event?.status?.type?.shortDetail || '').slice(0, 70),
    url: `https://www.espn.com/soccer/match/_/gameId/${id}`
  };
}

export function groupMatches(records, now = new Date()) {
  const timestamp = new Date(now).getTime();
  const deduped = [...new Map(records.filter(Boolean).map(match => [match.id, match])).values()];
  const live = deduped.filter(x => x.status === 'live').sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcoming = deduped.filter(x => x.status === 'scheduled' && new Date(x.date).getTime() >= timestamp - 3 * 3600_000)
    .sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 6);
  const results = deduped.filter(x => x.status === 'finished' && new Date(x.date).getTime() <= timestamp + 3 * 3600_000)
    .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  return { live, upcoming, results };
}

async function fetchEvents(url, fetchFn) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8500);
  try {
    const response = await fetchFn(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'RedDevilsDaily/1.2 (read-only football schedule)' }
    });
    if (!response.ok) throw new Error(`ESPN HTTP ${response.status}`);
    const json = await response.json();
    if (!Array.isArray(json?.events)) throw new Error('Unexpected schedule format');
    return json.events;
  } finally { clearTimeout(timeout); }
}

export async function loadMatches(fetchFn = fetch, now = new Date()) {
  // Fetch legacy league schedules and the newer all-team fixture feed concurrently.
  const primaryFixtureRequest = fetchEvents(FIXTURE_FALLBACK_URLS[0], fetchFn)
    .then(events => ({ events, error: false }))
    .catch(() => ({ events: [], error: true }));
  const [results, primaryFixture] = await Promise.all([
    Promise.allSettled(COMPETITIONS.map(async competition => {
      const events = await fetchEvents(`${SOURCE}/${competition.slug}/teams/${TEAM_ID}/schedule`, fetchFn);
      return { rawCount: events.length, matches: events.map(event => normalizeMatch(event, competition)).filter(Boolean) };
    })),
    primaryFixtureRequest
  ]);

  const perLeagueMatches = results.flatMap(result => result.status === 'fulfilled' ? result.value.matches : []);
  const errors = results.flatMap((result, index) => result.status === 'rejected'
    ? [COMPETITIONS[index].label] : []);
  let allMatches = perLeagueMatches;
  let fallbackStatus = 'not-needed';
  let fallbackSource = null;
  const primary = primaryFixture.events.map(event => normalizeMatch(event, { slug: 'all', label: 'ฟุตบอลสโมสร' })).filter(Boolean);
  if (primary.length) {
    allMatches = [...allMatches, ...primary];
    fallbackStatus = 'used';
    fallbackSource = new URL(FIXTURE_FALLBACK_URLS[0]).hostname;
  }

  // A response with only past matches does not prove there are no future fixtures.
  // ESPN endpoints are undocumented and can change: fail visibly, do not invent matches.
  if (!groupMatches(allMatches, now).upcoming.length) {
    fallbackStatus = 'unavailable';
    try {
      const events = await fetchEvents(FIXTURE_FALLBACK_URLS[1], fetchFn);
      const matches = events.map(event => normalizeMatch(event, { slug: 'all', label: 'ฟุตบอลสโมสร' })).filter(Boolean);
      if (matches.length) {
        allMatches = [...allMatches, ...matches];
        fallbackSource = new URL(FIXTURE_FALLBACK_URLS[1]).hostname;
        fallbackStatus = 'used';
      }
    } catch { /* do not invent fixture data */ }
  }

  const grouped = groupMatches(allMatches, now);
  return {
    ...grouped,
    source: 'ESPN (ข้อมูลจากแหล่งภายนอกอาจล่าช้าหรือเปลี่ยนแปลง)',
    sourceUrl: LINK,
    updatedAt: new Date(now).toISOString(),
    partial: errors.length > 0 || (fallbackStatus === 'unavailable' && !grouped.upcoming.length),
    errors,
    hasData: allMatches.length > 0,
    diagnostics: {
      sourcesOk: results.filter(item => item.status === 'fulfilled').length,
      sourcesFailed: errors.length,
      leagueEvents: results.reduce((count, item) => count + (item.status === 'fulfilled' ? item.value.rawCount : 0), 0),
      leagueMatchesAccepted: perLeagueMatches.length,
      fallback: fallbackStatus,
      fallbackSource,
      upcomingCount: grouped.upcoming.length,
      resultsCount: grouped.results.length
    }
  };
}
