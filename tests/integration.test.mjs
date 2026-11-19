import test from 'node:test';
import assert from 'node:assert/strict';
import { FEEDS } from '../lib/feeds.mjs';
import { handler as newsHandler } from '../netlify/functions/news.mjs';
import { handler as photoHandler } from '../netlify/functions/photos.mjs';

test('Netlify functions return valid JSON, sourced headlines, no unlicensed news thumbnails', async () => {
  const originalFetch = globalThis.fetch;
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item><title><![CDATA[Manchester United confirm player training]]></title>
  <link>https://www.manutd.com/en/news/example</link>
  <pubDate>Wed, 18 Nov 2026 11:00:00 GMT</pubDate>
  <media:thumbnail url="https://example.com/news-photo.jpg" />
  </item></channel></rss>`;
  const commons = { query: { pages: [{ pageid: 5, title: 'File:Manchester United training ground.jpg', imageinfo: [{
    url: 'https://upload.wikimedia.org/photograph.jpg', thumburl: 'https://upload.wikimedia.org/thumb.jpg',
    mime: 'image/jpeg', width: 1000, height: 800,
    extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: 'The photographer' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' } }
  }] }] } };
  globalThis.fetch = async url => String(url).includes('commons.wikimedia.org')
    ? new Response(JSON.stringify(commons), { status: 200, headers: { 'content-type': 'application/json' } })
    : new Response(rss, { status: 200, headers: { 'content-type': 'application/rss+xml' } });
  try {
    assert.equal(FEEDS.length, 4);
    const news = JSON.parse((await newsHandler()).body);
    assert.equal(news.articles.length, 1);
    assert.equal(news.articles[0].image, null);
    assert.equal(news.articles[0].url, 'https://www.manutd.com/en/news/example');
    const photos = JSON.parse((await photoHandler()).body);
    assert.equal(photos.photos.length, 1);
    assert.equal(photos.photos[0].license, 'CC BY 4.0');
  } finally { globalThis.fetch = originalFetch; }
});
