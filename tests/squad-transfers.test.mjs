import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoster, normalizePlayer, cleanHeadshot, loadSquad, SQUAD_SOURCE, mergeVerifiedSquad, normalizedPlayerName } from '../lib/squad.mjs';
import { REFERENCE_PLAYERS, REFERENCE_SOURCE, REFERENCE_SEASON } from '../lib/squad-reference.mjs';
import { classifyTransfer, loadTransfers, TRANSFER_FEEDS } from '../lib/transfers.mjs';
import { evaluateHealth } from '../lib/health.mjs';

const club = (title, url = 'https://www.manutd.com/en/news/detail/player-signs-contract') => ({
  title, summary: '', url, sourceId: 'manutd', category: 'transfers', source: 'Manchester United'
});
const media = (title) => ({ ...club(title, 'https://www.theguardian.com/football/2026/nov/19/united-transfer-confirmed'),
  sourceId: 'guardian', source: 'The Guardian' });

const sampleAthlete = { id: '12345', displayName: 'Example Player', jersey: '9', position: { abbreviation: 'FW', displayName: 'Forward' },
  headshot: { href: 'https://a.espncdn.com/i/headshots/soccer/players/full/12345.png' },
  statistics: { appearances: 11, goals: 5, assists: 3 } };

test('roster normalization handles position groups, explicit stats and empty stats', () => {
  const data = { athletes: [
    { position: { abbreviation: 'FW', displayName: 'Forwards' }, items: [sampleAthlete] },
    { position: { abbreviation: 'GK' }, items: [{ id: 333, displayName: 'Goalkeeper', jersey: 1 }] },
    { position: { abbreviation: 'MF' }, items: [{ id: 444, displayName: 'No Stats', statistics: [] }] }
  ] };
  const players = normalizeRoster(data);
  assert.equal(players.length, 3);
  assert.equal(players[0].name, 'Goalkeeper');
  assert.equal(players[0].jersey, '1');
  assert.equal(players[0].group, 'ผู้รักษาประตู');
  assert.equal(players[0].goals, null);
  assert.equal(players[2].name, 'Example Player');
  assert.equal(players[2].goals, 5);
  assert.equal(players[2].appearances, 11);
  assert.equal(players[2].assists, 3);
});

test('squad blocks unknown players, guessed number, fake picture, unverified stats', () => {
  assert.equal(normalizePlayer({id:'javascript:x',displayName:'Evil'}), null);
  assert.equal(normalizePlayer({id:'123',displayName:''}), null);
  const player = normalizePlayer({id:'123',displayName:'Valid',jersey:'99x',headshot:{href:'https://evil.site/image.jpg'},
    stats: {goals:'N/A', assists:'10', appearances:-1}});
  assert.equal(player.jersey, null);
  assert.equal(player.headshot, null);
  assert.equal(player.goals, null);
  assert.equal(player.appearances, null);
  assert.equal(player.assists, 10);
  assert.equal(cleanHeadshot('https://a.espncdn.com/i/headshots/soccer/players/full/123.png'),
    'https://a.espncdn.com/i/headshots/soccer/players/full/123.png');
  assert.equal(cleanHeadshot('http://a.espncdn.com/i/headshots/soccer/players/full/123.png'), null);
  assert.equal(cleanHeadshot('https://a.espncdn.com.evil.tld/i/headshots/soccer/players/full/123.png'), null);
});

test('official 2026/27 PL squad stays complete when ESPN is unavailable', async () => {
  const now = new Date('2026-11-19T09:30:00Z');
  assert.equal(REFERENCE_PLAYERS.length,33);
  assert.equal(new Set(REFERENCE_PLAYERS.map(p => p.jersey)).size,33);
  assert.equal(REFERENCE_SEASON,'2026/27');
  for (const [group,count] of Object.entries({'ผู้รักษาประตู':4,'กองหลัง':12,'กองกลาง':9,'กองหน้า':8}))
    assert.equal(REFERENCE_PLAYERS.filter(p => p.group===group).length,count);
  const empty = await loadSquad(async () => new Response(JSON.stringify({athletes:[]}),{status:200}),now);
  assert.equal(empty.count,33);
  assert.equal(empty.sourceUrl,REFERENCE_SOURCE);
  assert.equal(empty.updatedAt,now.toISOString());
  assert.equal(empty.partial,true);
  assert.equal(empty.enrichedCount,0);
  assert.equal(empty.players[0].appearances,null);
  const blocked = await loadSquad(async()=>new Response('',{status:403}),now);
  assert.equal(blocked.count,33);
  assert.equal(blocked.hasData,true);
});

test('ESPN supplements photos/stats but cannot replace official members or numbers', async () => {
  const player = {...sampleAthlete,displayName:'Matheus Cunha',jersey:'99',statistics:{appearances:5,goals:2,assists:1}};
  const data = await loadSquad(async url => {
    assert.equal(url,SQUAD_SOURCE);
    return new Response(JSON.stringify({athletes:[player,{id:33345,displayName:'Former Player',jersey:77}]}),{status:200});
  });
  assert.equal(data.count,33);
  assert.equal(data.enrichedCount,1);
  const matheus = data.players.find(p => p.name==='Matheus Cunha');
  assert.equal(matheus.jersey,'10');
  assert.equal(matheus.goals,2);
  assert.ok(matheus.headshot.endsWith('/12345.png'));
  assert.equal(data.players.some(p => p.name==='Former Player'),false);
  assert.equal(normalizedPlayerName('Lisandro Martínez'),normalizedPlayerName('Lisandro Martinez'));
  assert.equal(mergeVerifiedSquad([{id:'17',name:'Lisandro Martinez'}]).enriched,1);
});

test('only specific completed announcements on original club domain receive club status', () => {
  assert.equal(classifyTransfer(club('United signs new striker')), 'club');
  assert.equal(classifyTransfer(club('United announce contract extension for defender')), 'club');
  assert.equal(classifyTransfer(club('United reportedly signs new striker')), 'reported');
  assert.equal(classifyTransfer(club('United could sign a defender this summer')), 'reported');
  assert.equal(classifyTransfer(club('How United would sign talented striker')), 'reported');
  assert.equal(classifyTransfer(club('United signs new striker','https://www.manutd.com.evil.tld/article')), 'reported');
  assert.equal(classifyTransfer(media('Man United signing CONFIRMED by sources')), 'reported');
  assert.equal(classifyTransfer({ ...club('United players train for derby'), category: 'players' }), null);
  assert.equal(classifyTransfer({ ...club('United signs new striker'), sourceId:'google' }), 'reported');
});

test('transfer aggregator deduplicates verified stories and reports partial feed failures',async () => {
  const rss = `<?xml version="1.0"?><rss><channel><item><title>United signs new midfielder</title><link>https://www.manutd.com/en/news/detail/united-signs-midfielder</link><pubDate>Thu, 19 Nov 2026 08:00:00 GMT</pubDate><description>Official announcement</description></item></channel></rss>`;
  const goog = `<?xml version="1.0"?><rss><channel><item><title>Manchester United linked with striker</title><link>https://example.com/transfer-rumour</link><pubDate>Thu, 19 Nov 2026 07:00:00 GMT</pubDate></item></channel></rss>`;
  const data = await loadTransfers(async url => {
    if (url === TRANSFER_FEEDS[0].url) return new Response(rss,{status:200});
    if (url === TRANSFER_FEEDS[1].url) return new Response(goog,{status:200});
    return new Response('',{status:502});
  }, new Date('2026-11-19T09:00:00Z'));
  assert.equal(data.articles.length, 2);
  assert.equal(data.clubCount, 1);
  assert.equal(data.reportedCount, 1);
  assert.equal(data.partial, true);
  assert.equal(data.errors.length, 1);
  assert.ok(data.articles.every(a => a.image === null && !('sourceImage' in a)));
});

test('health check counts a valid but empty transfers feed as available', () => {
  const now = new Date('2026-11-19T12:00:00Z');
  const time = now.toISOString();
  const data = evaluateHealth({
    news: {updatedAt:time, articles:[{}]}, photos:{updatedAt:time,photos:[{}]},
    matches:{updatedAt:time,hasData:true}, standings:{updatedAt:time,hasData:true},
    squad:{updatedAt:time,hasData:true,players:[{}]}, transfers:{updatedAt:time,hasData:false,articles:[]}
  }, now);
  assert.equal(data.services.length,6);
  assert.equal(data.services.find(a => a.id === 'transfers').status,'ok');
  assert.equal(data.status,'ok');
});
