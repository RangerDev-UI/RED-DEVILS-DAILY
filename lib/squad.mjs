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
// Official PL 2026/27 squad is the membership source; ESPN enriches photos/stats.
import { REFERENCE_PLAYERS, REFERENCE_SOURCE, REFERENCE_CHECKED_AT, REFERENCE_SEASON } from './squad-reference.mjs';

export function normalizedPlayerName(name = '') {
  return String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export function mergeVerifiedSquad(espnPlayers = []) {
  const byName = new Map(espnPlayers.map(p => [normalizedPlayerName(p.name), p]));
  let enriched = 0;
  const players = REFERENCE_PLAYERS.map(verified => {
    const player = byName.get(normalizedPlayerName(verified.name));
    if (!player) return { ...verified };
    enriched++;
    return {
      ...verified, id: player.id, headshot: player.headshot || null,
      nationality: player.nationality || null,
      appearances: player.appearances, goals: player.goals, assists: player.assists,
      profileUrl: player.profileUrl, source: 'Premier League + ESPN'
    };
  });
  return { players, enriched };
}
export async function loadSquad(fetchFn = fetch, now = new Date()) {
  let espnPlayers = [];
  let providerError = null;
  try {
    const response = await fetchFn(SQUAD_SOURCE, { signal: AbortSignal.timeout(8500), headers: {
      Accept: 'application/json', 'User-Agent': 'RedDevilsDaily/1.3 (verified PL roster; ESPN enrichment)' } });
    if (!response.ok) throw new Error('ESPN roster HTTP ' + response.status);
    const payload = await response.json();
    if (!payload || (!Array.isArray(payload.athletes) && !Array.isArray(payload.roster))) throw new Error('Unexpected ESPN roster response');
    espnPlayers = normalizeRoster(payload);
    if (!espnPlayers.length) throw new Error('ESPN roster empty');
  } catch {
    providerError = 'ESPN ไม่มีข้อมูลรายชื่อเสริมหรือเชื่อมต่อไม่ได้';
  }
  const { players, enriched } = mergeVerifiedSquad(espnPlayers);
  return {
    players, count: players.length, source: 'Premier League 2026/27',
    sourceUrl: REFERENCE_SOURCE, season: REFERENCE_SEASON,
    rosterCheckedAt: REFERENCE_CHECKED_AT,
    updatedAt: new Date(now).toISOString(), hasData: players.length > 0,
    partial: Boolean(providerError) || enriched < players.length,
    stale: false, providerError, enrichedCount: enriched,
    statsNote: 'รายชื่อและเบอร์เสื้อจากพรีเมียร์ลีก 2026/27; รูปและสถิติจาก ESPN เท่าที่มีจริง ค่าที่ไม่มีแสดง —'
  };
}
