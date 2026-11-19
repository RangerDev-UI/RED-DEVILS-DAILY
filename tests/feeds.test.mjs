import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRss, safeUrl, categorize, deduplicate } from '../lib/feeds.mjs';
import { extractPhotos } from '../lib/commons.mjs';

const feed = { id: 'manutd', name: 'Manchester United', focused: true };
test('RSS parses and decodes headline, date, link and thumbnail', () => {
  const xml = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><item>
    <title><![CDATA[Man Utd &amp; transfer update]]></title><link>https://example.org/story</link>
    <description><![CDATA[<p>New contract discussions</p>]]></description>
    <pubDate>Wed, 18 Nov 2026 09:00:00 GMT</pubDate>
    <media:thumbnail url="https://example.org/image.jpg" /></item></channel></rss>`;
  const items = parseRss(xml, feed);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Man Utd & transfer update');
  assert.equal(items[0].sourceImage, 'https://example.org/image.jpg');
  assert.equal(items[0].category, 'transfers');
  assert.equal(items[0].publishedAt, '2026-11-18T09:00:00.000Z');
});
test('invalid and unsafe URLs are rejected', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('https://example.com/news'), 'https://example.com/news');
});
test('deduplicates same title and orders by newest date', () => {
  const arr = [
    { title: 'Manchester United latest', url: 'https://a.test/1', publishedAt: '2026-11-10' },
    { title: 'Man Utd training', url: 'https://a.test/3', publishedAt: '2026-11-12' },
    { title: 'Manchester United latest', url: 'https://b.test/1', publishedAt: '2026-11-13' }
  ];
  const result = deduplicate(arr);
  assert.equal(result.length, 2);
  assert.equal(result[0].title, 'Man Utd training');
});
test('categorization rules', () => {
  assert.equal(categorize('Manchester United vs Chelsea preview'), 'matches');
  assert.equal(categorize('New signing reported'), 'transfers');
});
test('Commons rejects non-free licenses and returns credits for CC images', () => {
  const sample = { query: { pages: {
    1: { pageid: 1, title: 'File:Old Trafford.jpg', imageinfo: [{
      url: 'https://upload.wikimedia.org/a.jpg', thumburl: 'https://upload.wikimedia.org/thumb.jpg',
      mime: 'image/jpeg', width: 1280, height: 720,
      extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<b>Photographer A</b>' } }
    }] },
    2: { pageid: 2, title: 'File:Private.jpg', imageinfo: [{
      url: 'https://upload.wikimedia.org/b.jpg', mime: 'image/jpeg', width: 1280, height: 720,
      extmetadata: { LicenseShortName: { value: 'All rights reserved' } }
    }] }
  } } };
  const result = extractPhotos(sample);
  assert.equal(result.length, 1);
  assert.equal(result[0].author, 'Photographer A');
});
