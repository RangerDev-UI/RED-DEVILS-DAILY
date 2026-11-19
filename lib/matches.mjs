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
const LINK = 'https://www.espn.com/soccer/team/fixtures/_/id/360';

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
  const ours = teams.find(item => String(item?.team?.id) === TEAM_ID);
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
    competition: competition.label,
    competitionSlug: competition.slug,
    opponent: rivalName.slice(0, 100),
    home: isHome,
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

export async function loadMatches(fetchFn = fetch, now = new Date()) {
  const results = await Promise.allSettled(COMPETITIONS.map(async competition => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8500);
    try {
      const response = await fetchFn(`${SOURCE}/${competition.slug}/teams/${TEAM_ID}/schedule`, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'RedDevilsDaily/1.1 (football fan schedule, source attribution)' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (!Array.isArray(json?.events)) throw new Error('Unexpected schedule format');
      return json.events.map(event => normalizeMatch(event, competition)).filter(Boolean);
    } finally { clearTimeout(timeout); }
  }));
  const matches = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const errors = results.flatMap((result, index) => result.status === 'rejected'
    ? [COMPETITIONS[index].label] : []);
  return {
    ...groupMatches(matches, now),
    source: 'ESPN (ตารางแข่งขันอาจเปลี่ยนแปลง)',
    sourceUrl: LINK,
    updatedAt: new Date(now).toISOString(),
    partial: errors.length > 0,
    errors,
    hasData: matches.length > 0
  };
}