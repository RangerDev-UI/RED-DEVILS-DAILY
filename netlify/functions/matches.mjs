import { loadMatches } from '../../lib/matches.mjs';

let cached = null;
let expiry = 0;
const liveWindow = (data, now = Date.now()) => (data?.live?.length > 0) || (data?.upcoming || []).some(m => {
  const delta = new Date(m.date).getTime() - now;
  return delta < 35 * 60_000 && delta > -3 * 60 * 60_000;
});

export async function handler() {
  const now = Date.now();
  if (cached && now < expiry) return respond(cached);
  try {
    const payload = await loadMatches();
    if (!payload.hasData && cached?.hasData) {
      return respond({ ...cached, stale: true, partial: true, errors: ['แหล่งข้อมูลยังไม่ตอบกลับ'] });
    }
    cached = payload;
    expiry = Date.now() + (liveWindow(payload) ? 25_000 : 10 * 60_000);
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
      'Cache-Control': liveWindow(payload) ? 'public, max-age=0, s-maxage=10, stale-while-revalidate=10' : 'public, max-age=30, s-maxage=60, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(payload)
  };
}
