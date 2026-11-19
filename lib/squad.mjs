/** ESPN's undocumented team roster feed. No players/statistics are fabricated. */
export const SQUAD_SOURCE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/360/roster';
export const SQUAD_PAGE = 'https://www.espn.com/soccer/team/squad/_/id/360/manchester-united';

const positiveId = value => /^\d{1,12}$/.test(String(value ?? '')) ? String(value) : '';
const text = (value, max = 110) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validNumber = value => (typeof value === 'number' && Number.isFinite(value) && value >= 0) || (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())) ? Number(value) : null;

export function cleanHeadshot(candidate, athleteId = '') {
  const value = typeof candidate === 'string' ? candidate : candidate?.href;
  if (typeof value === 'string') {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && url.hostname === 'a.espncdn.com' &&
        /^\/i\/headshots\/soccer\/players\/(?:full|large|small)\/\d{1,12}\.png$/.test(url.pathname)) return url.href;
    } catch { /* no valid photo */ }
  }
  // A missing or invalid image is not replaced by a guessed image URL.
  return null;
}

const POSITIONS = { GK: 'ผู้รักษาประตู', G: 'ผู้รักษาประตู', D: 'กองหลัง', DF: 'กองหลัง', CB: 'กองหลัง', LB: 'กองหลัง', RB: 'กองหลัง',
  M: 'กองกลาง', MF: 'กองกลาง', CM: 'กองกลาง', DM: 'กองกลาง', AM: 'กองกลาง', F: 'กองหน้า', FW: 'กองหน้า', ST: 'กองหน้า', LW: 'กองหน้า', RW: 'กองหน้า' };
const GROUPS = ['ผู้รักษาประตู','กองหลัง','กองกลาง','กองหน้า','อื่น ๆ'];
function positionOf(a, group) {
  const p = a?.position || a?.athlete?.position || group?.position || {};
  const abbrev = text(typeof p === 'string' ? p : p.abbreviation || p.abbrev).toUpperCase();
  const name = text(typeof p === 'object' ? p.displayName || p.name : p, 60);
  const n = (name + ' ' + abbrev).toLowerCase();
  let section = POSITIONS[abbrev] || '';
  if (!section) section = /goalkeeper|keeper|ผู้รักษา/.test(n) ? GROUPS[0] : /defen|back|กองหลัง/.test(n) ? GROUPS[1] :
    /midfield|กองกลาง/.test(n) ? GROUPS[2] : /forwar|winger|striker|กองหน้า/.test(n) ? GROUPS[3] : GROUPS[4];
  return { position: name || section, group: section };
}

// Stats are optional. ESPN's team roster does not always provide season totals.
function rawStat(source, aliases) {
  if (!source || typeof source !== 'object') return null;
  for (const key of aliases) {
    const value = source[key];
    const n = validNumber(typeof value === 'object' && value !== null ? value.value ?? value.displayValue : value);
    if (n !== null) return n;
  }
  return null;
}
function playerStats(a) {
  const s = a.statistics || a.stats || {};
  // Never treat arrays or career totals as current-season stats.
  if (Array.isArray(s) || (typeof s === 'object' && s !== null && Array.isArray(s.splits))) return { appearances: null, goals: null, assists: null };
  return { appearances: rawStat(s, ['appearances','gamesPlayed','matchesPlayed','apps']), goals: rawStat(s, ['goals','goalsScored']), assists: rawStat(s, ['assists']) };
}
export function normalizePlayer(item, group = null) {
  const a = item?.athlete && typeof item.athlete === 'object' ? item.athlete : item;
  if (!a || typeof a !== 'object') return null;
  const id = positiveId(a.id);
  const name = text(a.displayName || a.fullName || a.name);
  if (!id || !name) return null;
  const jerseyRaw = a.jersey ?? a.jerseyNumber ?? item?.jersey;
  const jersey = /^\d{1,3}$/.test(String(jerseyRaw ?? '')) ? String(Number(jerseyRaw)) : null;
  const pos = positionOf(a, group);
  const headshot = cleanHeadshot(a.headshot || item?.headshot, id);
  return { id, name, jersey, position: pos.position, group: pos.group, headshot,
    nationality: text(a.citizenship || a.birthPlace?.country || a.nationality, 55) || null,
    ...playerStats(a), profileUrl: `https://www.espn.com/soccer/player/_/id/${id}` };
}
export function normalizeRoster(payload) {
  const athleteList = Array.isArray(payload?.athletes) ? payload.athletes : Array.isArray(payload?.roster) ? payload.roster : [];
  const groups = athleteList.flatMap(value => {
    if (Array.isArray(value?.items)) return value.items.map(item => ({ item, group: value }));
    if (Array.isArray(value?.athletes)) return value.athletes.map(item => ({ item, group: value }));
    return [{ item: value, group: null }];
  });
  const seen = new Set();
  const players = groups.map(({ item, group }) => normalizePlayer(item, group)).filter(player => {
    if (!player || seen.has(player.id)) return false;
    seen.add(player.id); return true;
  });
  players.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) ||
    (Number(a.jersey ?? 999) - Number(b.jersey ?? 999)) || a.name.localeCompare(b.name));
  return players.slice(0, 60);
}
export async function loadSquad(fetchFn = fetch, now = new Date()) {
  const response = await fetchFn(SQUAD_SOURCE, { signal: AbortSignal.timeout(8500), headers: {
    Accept: 'application/json', 'User-Agent': 'RedDevilsDaily/1.2 (fan squad information; source attribution)' } });
  if (!response.ok) throw new Error(`ESPN roster HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.athletes) && !Array.isArray(payload.roster)) throw new Error('Unexpected ESPN roster response');
  const players = normalizeRoster(payload);
  if (!players.length) throw new Error('Roster contained no verifiable players');
  return { players, count: players.length, source: 'ESPN', sourceUrl: SQUAD_PAGE,
    updatedAt: new Date(now).toISOString(), hasData: true, partial: false, stale: false,
    statsNote: 'สถิติเป็นเฉพาะค่าที่แหล่งข้อมูลส่งมา หากไม่มีข้อมูลจะแสดง — และไม่คำนวณแทน' };
}
