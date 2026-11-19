import { loadCommonsPhotos } from '../../lib/commons.mjs';

const CACHE_MS = 15 * 60 * 1000;
let cache = null;
let expiry = 0;
export async function handler() {
  if (cache && Date.now() < expiry) return respond(cache);
  try {
    const photos = await loadCommonsPhotos();
    const payload = { photos, updatedAt: new Date().toISOString(), source: 'Wikimedia Commons', note: 'Creative Commons or public-domain illustrative photos, not necessarily from the reported event' };
    if (photos.length || !cache) { cache = payload; expiry = Date.now() + CACHE_MS; }
    return respond(photos.length ? payload : (cache || payload));
  } catch {
    return respond(cache || { photos: [], updatedAt: null, source: 'Wikimedia Commons', note: 'Photo source temporarily unavailable' });
  }
}
function respond(payload) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=900, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(payload)
  };
}
