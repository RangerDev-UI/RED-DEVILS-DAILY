import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStandings, seasonStart, loadStandings } from '../lib/standings.mjs';
import { evaluateHealth } from '../lib/health.mjs';
import { handler as standingsHandler } from '../netlify/functions/standings.mjs';

const data = {
  season: { year: 2026, displayName: '2026-27' },
  children: [{ name: 'Premier League', standings: { entries: [
    { team: { id:'360', displayName: 'Manchester United' }, stats: [
      {name:'rank',value:3},{name:'gamesPlayed',value:12},{name:'wins',value:7},
      {name:'ties',value:3},{name:'losses',value:2},{name:'pointsFor',value:23},
      {name:'pointsAgainst',value:12},{name:'pointDifferential',value:11},{name:'points',value:24}] },
    { team: {id:'123',displayName:'Another FC'},stats:[{name:'points',value:20}]} ] }}]
};

test('standing parser uses current 2026/27 season and correct keys, never guesses unknown stats',()=>{
  assert.equal(seasonStart(new Date('2026-11-19')), 2026);
  assert.equal(seasonStart(new Date('2027-02-01')), 2026);
  const parsed = normalizeStandings(data,2026);
  assert.equal(parsed.groups[0].rows[0].name,'Manchester United');
  assert.equal(parsed.groups[0].rows[0].points,24);
  assert.equal(parsed.groups[0].rows[0].gd,11);
  assert.equal(parsed.groups[0].rows[0].logo,'https://a.espncdn.com/i/teamlogos/soccer/500/360.png');
  assert.equal(parsed.groups[0].rows[1].played,null);
  assert.equal(parsed.groups[0].rows[1].rank,null);
});

test('standings parser fails on wrong season, empty groups or unsafe team identifiers',()=>{
  assert.throws(()=>normalizeStandings({...data,season:{year:2025}},2026),/season/i);
  assert.throws(()=>normalizeStandings({...data,children:[]},2026),/No valid/);
  const bad = structuredClone(data);
  bad.children[0].standings.entries[0].team.id='javascript:alert(1)';
  const rows=normalizeStandings(bad,2026).groups[0].rows;
  assert.equal(rows.length,1);
});

test('standings fetching fails visibly when provider fails and returns current season only',async()=>{
  const out=await loadStandings(async url=>{
    assert.match(url,/season=2026/);
    return new Response(JSON.stringify(data),{status:200});
  },new Date('2026-11-19'));
  assert.equal(out.groups[0].rows[0].points,24);
  await assert.rejects(()=>loadStandings(async()=>new Response('',{status:503})),/HTTP 503/);
});

test('standings Netlify function delivers a league table in JSON',async()=>{
  const saved=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({ ...data,season:{year:seasonStart()} }),{status:200});
  try {
    const response=await standingsHandler();
    const decoded=JSON.parse(response.body);
    assert.equal(response.statusCode,200);
    assert.equal(decoded.groups[0].rows[0].points,24);
  } finally {globalThis.fetch=saved;}
});

test('health report separates check timestamps, partial feeds, stale and empty data',()=>{
  const now = new Date('2026-11-19T12:00:00Z');
  const latest = '2026-11-19T11:52:00Z';
  const base={
    news:{articles:[{publishedAt:'2026-11-19T10:00:00Z'}],updatedAt:latest, errors:[]},
    photos:{photos:[{}],updatedAt:latest},
    matches:{upcoming:[],hasData:true,updatedAt:latest},
    standings:{groups:[{}],hasData:true,updatedAt:latest},
    squad:{players:[{id:'1'}],hasData:true,updatedAt:latest},
    transfers:{articles:[],hasData:false,updatedAt:latest}
  };
  const healthy=evaluateHealth(base,now);
  assert.equal(healthy.status,'ok');
  assert.equal(healthy.services.length,6);
  assert.equal(healthy.latestPublishedAt,'2026-11-19T10:00:00.000Z');
  const partial=evaluateHealth({...base,news:{...base.news,errors:[{source:'guardian'}]}},now);
  assert.equal(partial.services[0].status,'partial');
  const failed=evaluateHealth({...base,matches:{...base.matches,hasData:false},photos:{...base.photos,updatedAt:'2026-11-19T07:00:00Z'}},now);
  assert.equal(failed.status,'warning');
  assert.equal(failed.services[1].status,'stale');
  assert.equal(failed.services[2].status,'unavailable');
});
