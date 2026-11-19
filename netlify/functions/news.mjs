import { FEEDS, loadRssFeed, deduplicate } from '../../lib/feeds.mjs';

const CACHE_MS = 10 * 60 * 1000;
let inMemory = null;
let expires = 0;

export async function handler() {
  if (inMemory && Date.now() < expires) return respond(inMemory);
  const results = await Promise.allSettled(FEEDS.map(feed => loadRssFeed(feed)));
  const loaded = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const errors = results.flatMap((result, index) => result.status === 'rejected'
    ? [{ source: FEEDS[index].name, error: result.reason?.message || 'Feed unavailable' }] : []);
  const articles = deduplicate(loaded).slice(0, 42);
  const payload = {
    articles: articles.map(({ sourceImage, ...article }) => ({
      ...article,
      // Opt in only after ensuring publication rights for third-party thumbnails.
      image: process.env.ALLOW_PUBLISHER_THUMBNAILS === 'true' ? sourceImage : null
    })),
    updatedAt: new Date().toISOString(),
    sources: FEEDS.map(({ id, name, website }) => ({ id, name, website })),
    partial: errors.length > 0,
    errors,
    photoPolicy: 'Wikimedia Commons free-licensed images by default; article images are illustrative'
  };
  if (articles.length || !inMemory) { inMemory = payload; expires = Date.now() + CACHE_MS; }
  // A stale but real snapshot is better than a fictitious headline when RSS is down.
  return respond(!articles.length && inMemory?.articles?.length ? inMemory : payload);
}

function respond(payload) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(payload)
  };
}
