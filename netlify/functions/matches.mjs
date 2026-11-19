import { loadMatches } from '../../lib/matches.mjs';

let cached = null;
let expiry = 0;

export async function handler() {
  const now = Date.now();
  if (cached && now < expiry) return respond(cached);
  try {
    const payload = await loadMatches();
    if (!payload.hasData && cached?.hasData) {
      return respond({ ...cached, stale: true, partial: true, errors: ['แหล่งข้อมูลยังไม่ตอบกลับ'] });
    }
    cached = payload;
    expiry = Date.now() + (payload.live?.length ? 60_000 : 10 * 60_000);
    return respond(payload);
  } catch {
    return respond(cached ? { ...cached, stale: true, partial: true } : {
      live: [], upcoming: [], results: [], updatedAt: null,
      hasData: false, stale: false, partial: true,
      source: 'ESPN', sourceUrl: 'https://www.espn.com/soccer/team/fixtures/_/id/360',
      errors: ['ไม่สามารถเชื่อมต่อแหล่งข้อมูลการแข่งขัน']
    });
  }
}

function respond(payload) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(payload)
  };
}