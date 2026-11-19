import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMatch, groupMatches, loadMatches, COMPETITIONS } from '../lib/matches.mjs';
import { handler as matchesHandler } from '../netlify/functions/matches.mjs';

function makeEvent(id, date, state = 'pre', home = true, scored = true) {
  const man = { homeAway: home ? 'home' : 'away', team: { id: '360', displayName: 'Manchester United' }, score: scored ? { displayValue: '2' } : null };
  const rival = { homeAway: home ? 'away' : 'home', team: { id: '364', displayName: 'Liverpool' }, score: scored ? { displayValue: '1' } : null };
  return { id, date, status: { type: { state } }, competitions: [{ competitors: [man, rival], venue: { fullName: 'Old Trafford' } }] };
}

test('normalizes only authenticated United fixtures and preserves unknown scores', () => {
  const comp = COMPETITIONS[0];
  const kickoff = '2026-11-25T20:00:00Z';
  const match = normalizeMatch(makeEvent('401856001', kickoff), comp);
  assert.equal(match.opponent, 'Liverpool');
  assert.equal(match.status, 'scheduled');
  assert.equal(match.scoreUnited, null);
  assert.equal(match.scoreOpponent, null);
  assert.equal(match.home, true);
  assert.equal(match.url, 'https://www.espn.com/soccer/match/_/gameId/401856001');
  assert.equal(normalizeMatch({ ...makeEvent('401856001', kickoff), id: 'javascript:hi' }, comp), null);
  assert.equal(normalizeMatch({ ...makeEvent('401856001', kickoff), competitions: [{ competitors: [{ team: { id: '1' } }, { team: { id: '2' } }] }] }, comp), null);
  assert.equal(normalizeMatch({ ...makeEvent('401856001', kickoff), date: 'bad date' }, comp), null);
});

test('match results and upcoming schedule are deduplicated and chronologically ordered', () => {
  const comp = COMPETITIONS[0];
  const future = normalizeMatch(makeEvent('401856002', '2026-11-28T13:00:00Z', 'pre'), comp);
  const futureSoon = normalizeMatch(makeEvent('401856003', '2026-11-26T13:00:00Z', 'pre', false), comp);
  const played = normalizeMatch(makeEvent('401856004', '2026-11-15T16:00:00Z', 'post', false), comp);
  const currentlyPlaying = normalizeMatch(makeEvent('401856005', '2026-11-19T12:00:00Z', 'in'), comp);
  const grouped = groupMatches([played, future, futureSoon, future, currentlyPlaying], new Date('2026-11-19T12:10:00Z'));
  assert.deepEqual(grouped.upcoming.map(m => m.id), ['401856003', '401856002']);
  assert.equal(grouped.live[0].id, '401856005');
  assert.equal(grouped.results[0].scoreUnited, '2');
  assert.equal(grouped.results[0].scoreOpponent, '1');
});

test('partial provider failure returns only verified matches and identifies missing competitions', async () => {
  const event = makeEvent('401856006', '2026-11-26T15:00:00Z');
  const fetchStub = async (url) => {
    if (String(url).includes('/eng.fa/')) throw new Error('Upstream timeout');
    return new Response(JSON.stringify({ events: [event] }), { status: 200 });
  };
  const data = await loadMatches(fetchStub, new Date('2026-11-19T00:00:00Z'));
  assert.equal(data.partial, true);
  assert.ok(data.errors.includes('เอฟเอ คัพ'));
  assert.equal(data.upcoming.length, 1);
  assert.equal(data.upcoming[0].scoreUnited, null);
  assert.equal(data.hasData, true);
});

test('all failing providers return no invented fixtures', async () => {
  const data = await loadMatches(async () => new Response('', { status: 503 }));
  assert.equal(data.hasData, false);
  assert.equal(data.upcoming.length, 0);
  assert.equal(data.results.length, 0);
  assert.equal(data.errors.length, COMPETITIONS.length);
});

test('matches Netlify function delivers cacheable, attributed JSON', async () => {
  const previous = globalThis.fetch;
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  globalThis.fetch = async () => new Response(JSON.stringify({ events: [makeEvent('401856101', tomorrow)] }), { status: 200 });
  try {
    const response = await matchesHandler();
    assert.equal(response.statusCode, 200);
    const data = JSON.parse(response.body);
    assert.equal(data.upcoming.length, 1);
    assert.equal(data.upcoming[0].scoreUnited, null);
    assert.equal(data.sourceUrl, 'https://www.espn.com/soccer/team/fixtures/_/id/360');
  } finally { globalThis.fetch = previous; }
});

test('team logos are resolved only from trusted ESPN assets, with safe ID fallback', () => {
  const comp = COMPETITIONS[0];
  const event = makeEvent('401856201', '2026-11-25T20:00:00Z');
  event.competitions[0].competitors[0].team.logos = [{ href: 'https://a.espncdn.com/i/teamlogos/soccer/100/360.png' }];
  event.competitions[0].competitors[1].team.logo = 'https://malicious.example/logo.png';
  const match = normalizeMatch(event, comp);
  assert.equal(match.logoUnited, 'https://a.espncdn.com/i/teamlogos/soccer/100/360.png');
  assert.equal(match.logoOpponent, 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png');
  event.competitions[0].competitors[1].team.id = '<bad>';
  assert.equal(normalizeMatch(event, comp).logoOpponent, null);
});

test('logo data survives through the match API', async () => {
  const event = makeEvent('401856202', new Date(Date.now() + 86400000).toISOString());
  const data = await loadMatches(async () => new Response(JSON.stringify({ events: [event] }), { status: 200 }));
  assert.equal(data.upcoming[0].logoUnited, 'https://a.espncdn.com/i/teamlogos/soccer/500/360.png');
  assert.equal(data.upcoming[0].logoOpponent, 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png');
});

test('fallback fixtures feed restores next match when league schedules only include results', async () => {
  const now = new Date('2026-11-19T12:00:00Z');
  const past = makeEvent('401999010', '2026-11-08T14:00:00Z', 'post');
  const future = makeEvent('401999011', '2026-11-22T16:30:00Z', 'pre', false);
  for (const c of future.competitions[0].competitors) {
    c.id = c.team.id;
    delete c.team.id;
  }
  const calls = [];
  const fetchStub = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/soccer/all/teams/360/schedule')) {
      return new Response(JSON.stringify({ events: [future] }), { status: 200 });
    }
    return new Response(JSON.stringify({ events: [past] }), { status: 200 });
  };
  const data = await loadMatches(fetchStub, now);
  assert.equal(data.upcoming.length, 1);
  assert.equal(data.upcoming[0].id, '401999011');
  assert.equal(data.upcoming[0].opponent, 'Liverpool');
  assert.equal(data.results.length, 1);
  assert.equal(data.diagnostics.fallback, 'used');
  assert.equal(data.diagnostics.leagueEvents, 5);
  assert.ok(calls.some(url => url.includes('site.web.api.espn.com')));
});

test('empty ESPN feeds show no invented matches and report diagnostics', async () => {
  const data = await loadMatches(async () => new Response(JSON.stringify({ events: [] }), { status: 200 }),
    new Date('2026-11-19T12:00:00Z'));
  assert.equal(data.hasData, false);
  assert.deepEqual(data.upcoming, []);
  assert.deepEqual(data.results, []);
  assert.equal(data.diagnostics.leagueEvents, 0);
  assert.equal(data.diagnostics.fallback, 'unavailable');
});
