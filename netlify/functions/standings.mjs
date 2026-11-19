import { loadStandings, STANDINGS_LINK } from '../../lib/standings.mjs';
let cached = null, expires = 0;
export async function handler() {
  if (cached && Date.now() < expires) return response(cached);
  try {
    const data = await loadStandings();
    cached = data; expires = Date.now() + 30 * 60_000;
    return response(data);
  } catch {
    return response(cached ? { ...cached, stale: true, error: 'แหล่งข้อมูลตารางคะแนนไม่ตอบกลับ' } : {
      source: 'ESPN', sourceUrl: STANDINGS_LINK, groups: [], updatedAt: null, hasData: false,
      stale: true, error: 'ไม่สามารถดึงตารางคะแนนพรีเมียร์ลีกได้'
    });
  }
}
function response(data) {
  return { statusCode: 200, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=60'
  }, body: JSON.stringify(data) };
}
