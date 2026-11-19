import { loadTransfers } from '../../lib/transfers.mjs';
let cache = null, expiry = 0;
export async function handler() {
  if (cache && Date.now() < expiry) return respond(cache);
  try {
    const data = await loadTransfers();
    if (data.hasData || !cache) { cache = data; expiry = Date.now() + 10 * 60_000; }
    return respond(!data.hasData && cache?.hasData ? { ...cache, stale: true, partial: true, errors: data.errors } : data);
  } catch {
    return respond(cache ? { ...cache, stale: true, partial: true } : {
      articles: [], hasData: false, updatedAt: null, stale: true, partial: true, errors: ['ไม่สามารถอ่านฟีดข่าวซื้อขาย']
    });
  }
}
function respond(data) { return { statusCode: 200, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=300'
}, body: JSON.stringify(data) }; }
