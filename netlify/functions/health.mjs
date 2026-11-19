import { handler as news } from './news.mjs';
import { handler as photos } from './photos.mjs';
import { handler as matches } from './matches.mjs';
import { handler as standings } from './standings.mjs';
import { evaluateHealth } from '../../lib/health.mjs';
export async function checkHealth() {
  const names = ['news', 'photos', 'matches', 'standings'];
  const handlers = [news, photos, matches, standings];
  const outputs = await Promise.allSettled(handlers.map(handler => handler()));
  const payloads = Object.fromEntries(outputs.map((r, index) => {
    try { return [names[index], r.status === 'fulfilled' ? JSON.parse(r.value.body) : null]; }
    catch { return [names[index], null]; }
  }));
  return evaluateHealth(payloads);
}
export async function handler() {
  const data = await checkHealth();
  return { statusCode: data.status === 'warning' ? 503 : 200, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'
  }, body: JSON.stringify(data) };
}
