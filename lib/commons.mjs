import { safeUrl, decodeEntities } from './feeds.mjs';

const SEARCHES = [
  'Manchester United football',
  'Manchester United Old Trafford',
  'Manchester United 2026'
];

function strip(value = '') {
  return decodeEntities(String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 110);
}

function isFreeLicense(meta = {}) {
  const l = strip(meta.LicenseShortName?.value || '').toLowerCase();
  return /^(cc\s*(by|0)|public domain|pd-|cc-by)/i.test(l) || l === 'cc0';
}

export function extractPhotos(json) {
  const pages = Object.values(json?.query?.pages || {});
  return pages.flatMap(page => {
    const info = page.imageinfo?.[0];
    if (!info) return [];
    const meta = info.extmetadata || {};
    const original = safeUrl(info.url);
    const image = safeUrl(info.thumburl || info.url);
    const title = (page.title || '').replace(/^File:/, '');
    const filename = title.toLowerCase();
    const mime = info.mime || '';
    if (!image || !original || !isFreeLicense(meta) ||
        !/^image\/(jpeg|png|webp)$/i.test(mime) ||
        /(logo|crest|badge|vector|shield|kit\b|shirt|insignia|emblem|coat.of.arms|icon|flag)/.test(filename)) return [];
    if (info.width < 450 || info.height < 270) return [];
    const url = safeUrl(info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title || '')}`);
    const licenseUrl = safeUrl(meta.LicenseUrl?.value) || url;
    return [{
      id: page.pageid,
      title: title.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').slice(0, 130),
      image,
      original,
      url,
      width: info.thumbwidth || info.width,
      height: info.thumbheight || info.height,
      author: strip(meta.Artist?.value) || 'Wikimedia Commons contributor',
      license: strip(meta.LicenseShortName?.value) || 'Free license',
      licenseUrl,
      timestamp: info.timestamp || null
    }];
  });
}

async function search(query, fetchFn) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  const params = {
    action: 'query', generator: 'search', gsrsearch: query,
    gsrnamespace: '6', gsrlimit: '45', prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata|timestamp', iiurlwidth: '1280',
    format: 'json', formatversion: '2'
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetchFn(url.href, {
    signal: AbortSignal.timeout(12000),
    headers: { 'Accept': 'application/json', 'User-Agent': 'RedDevilsDaily/1.0 (photo attribution viewer)' }
  });
  if (!response.ok) throw new Error(`Commons HTTP ${response.status}`);
  return extractPhotos(await response.json());
}

export async function loadCommonsPhotos(fetchFn = fetch) {
  const results = await Promise.allSettled(SEARCHES.map(query => search(query, fetchFn)));
  const all = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const seen = new Set();
  return all.filter(photo => {
    if (seen.has(photo.id)) return false;
    seen.add(photo.id); return true;
  }).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, 35);
}
