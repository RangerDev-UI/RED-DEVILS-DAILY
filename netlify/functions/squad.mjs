import { loadSquad } from '../../lib/squad.mjs';
import { REFERENCE_SOURCE } from '../../lib/squad-reference.mjs';
let cache = null, expiry = 0;
export async function handler() {
  if (cache && Date.now() < expiry) return respond(cache);
  try {
    const data = await loadSquad();
    cache = data;
    expiry = Date.now() + 3 * 3600_000;
    return respond(data);
  } catch {
    return respond(cache ? { ...cache, stale: true, error: 'แหล่งรายชื่อนักเตะตอบกลับไม่ได้' } : {
      players: [], count: 0, source: 'Premier League 2026/27', sourceUrl: REFERENCE_SOURCE, updatedAt: null, hasData: false,
      stale: true, error: 'ยังไม่สามารถดึงรายชื่อได้', statsNote: 'ยังไม่มีข้อมูล'
    });
  }
}
function respond(data) { return { statusCode: 200, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60, s-maxage=900, stale-while-revalidate=300'
}, body: JSON.stringify(data) }; }
