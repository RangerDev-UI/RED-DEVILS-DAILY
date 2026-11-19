/**
 * Minimal, dependency-free RSS 2.0 parser for headlines (not full-article HTML).
 * All user-facing strings and URLs are further escaped by the frontend.
 */
export const FEEDS = [
  {
    id: 'manutd',
    name: 'Manchester United',
    url: 'https://www.manutd.com/Feeds/NewsSecondRSSFeed',
    focused: true,
    website: 'https://www.manutd.com/en/news'
  },
  {
    id: 'guardian',
    name: 'The Guardian',
    url: 'https://www.theguardian.com/football/manchester-united/rss',
    focused: true,
    website: 'https://www.theguardian.com/football/manchester-united'
  },
  {
    id: 'google',
    name: 'Google News',
    url: 'https://news.google.com/rss/search?q=Manchester%20United%20when%3A4d&hl=en-GB&gl=GB&ceid=GB%3Aen',
    focused: false,
    website: 'https://news.google.com/search?q=Manchester%20United'
  },
  {
    id: 'google-th',
    name: 'ข่าวกีฬาไทย',
    url: 'https://news.google.com/rss/search?q=%E0%B9%81%E0%B8%A1%E0%B8%99%E0%B8%A2%E0%B8%B9%20OR%20%22%E0%B9%81%E0%B8%A1%E0%B8%99%E0%B9%80%E0%B8%8A%E0%B8%AA%E0%B9%80%E0%B8%95%E0%B8%AD%E0%B8%A3%E0%B9%8C%20%E0%B8%A2%E0%B8%B9%E0%B9%84%E0%B8%99%E0%B9%80%E0%B8%95%E0%B9%87%E0%B8%94%22%20when%3A4d&hl=th&gl=TH&ceid=TH%3Ath',
    focused: false,
    website: 'https://news.google.com/search?q=%E0%B9%81%E0%B8%A1%E0%B8%99%E0%B8%A2%E0%B8%B9&hl=th&gl=TH&ceid=TH%3Ath'
  }
];

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', pound: '£', euro: '€', copy: '©'
};

export function decodeEntities(value = '') {
  return String(value).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const num = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(num) && num > 0 && num <= 0x10ffff && !(num >= 0xd800 && num <= 0xdfff)
        ? String.fromCodePoint(num)
        : all;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? all;
  });
}

function field(block, tag) {
  const name = tag.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`, 'i'));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function plain(value = '') {
  return decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

function attr(tag, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const m = tag.match(pattern);
  return m ? decodeEntities(m[1] ?? m[2]) : '';
}

export function safeUrl(value = '') {
  try {
    const url = new URL(String(value).trim());
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function extractImage(block) {
  const tags = block.match(/<(?:media:thumbnail|media:content|enclosure)\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const link = safeUrl(attr(tag, 'url'));
    const type = attr(tag, 'type');
    if (link && (tag.toLowerCase().startsWith('<media:thumbnail') ||
      type.startsWith('image/') || /\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(link))) return link;
  }
  // Some publishers put an image within the HTML item description.
  const htmlImg = block.match(/<img\b[^>]*>/i)?.[0];
  return htmlImg ? safeUrl(attr(htmlImg, 'src')) : '';
}

export function categorize(title, description = '') {
  const s = `${title} ${description}`.toLowerCase();
  if (/transfer|signing|signs |signed |deal |bid |target|loan |contract|contract extension|exit |depart|join |move to|summer window|fees? agreed|rumour|rumor|ย้ายทีม|เสริมทัพ|เซ็นสัญญา|ค่าตัว|ปล่อยยืม|ตลาดซื้อขาย|เป้าหมายเสริม/.test(s)) return 'transfers';
  if (/fixture|kick.off|score|match|vs\.? |win over|defeat|draw with|premier league|europa league|champions league|goalkeeper saves|hat.trick|derby|fa cup|carabao|ผลบอล|พรีวิว|โปรแกรมแข่ง|ตารางคะแนน|พรีเมียร์ ลีก|นัดล่าสุด|คาราบาว|เอฟเอคัพ/.test(s)) return 'matches';
  if (/injur|recover|training|fitness|player|squad|captain|midfielder|striker|defender|forward|บาดเจ็บ|อาการเจ็บ|นักเตะ|ฟิต|กัปตัน|ผู้รักษาประตู/.test(s)) return 'players';
  return 'club';
}

export function parseRss(xml, feed) {
  if (!/<(?:rss|feed)\b/i.test(xml)) throw new Error('Invalid RSS XML');
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)];
  return items.slice(0, 35).map((entry, i) => {
    const block = entry[1];
    const title = plain(field(block, 'title')).slice(0, 250);
    const link = safeUrl(plain(field(block, 'link')));
    const rawDate = field(block, 'pubDate') || field(block, 'dc:date') || field(block, 'published');
    const date = new Date(rawDate);
    const publishedAt = Number.isNaN(date.getTime()) ? null : date.toISOString();
    const summary = plain(field(block, 'description')).slice(0, 220);
    const sourceName = plain(field(block, 'source')) || feed.name;
    const cleanTitle = feed.id.startsWith('google')
      ? title.replace(new RegExp(`\\s+-\\s+${sourceName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i'), '')
      : title;
    return {
      id: `${feed.id}-${i}-${encodeURIComponent(link || title).slice(-90)}`,
      title: cleanTitle,
      url: link,
      source: sourceName,
      sourceId: feed.id,
      publishedAt,
      summary,
      category: categorize(cleanTitle, summary),
      sourceImage: extractImage(block)
    };
  }).filter(item => item.title && item.url && (feed.focused ||
    /manchester united|man utd|man united|old trafford|red devils|แมนยู|แมนเชสเตอร์ ยูไนเต็ด|ปีศาจแดง/i.test(`${item.title} ${item.summary}`)));
}

export function deduplicate(items) {
  const seenLinks = new Set();
  const seenTitles = new Set();
  return items.filter(item => {
    const title = item.title.toLowerCase().replace(/[^a-z0-9ก-๙]/gi, '').slice(0, 75);
    const link = item.url.replace(/[?#].*$/, '');
    if (seenLinks.has(link) || seenTitles.has(title)) return false;
    seenLinks.add(link); seenTitles.add(title);
    return true;
  }).sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
}

export async function loadRssFeed(feed, fetchFn = fetch) {
  const response = await fetchFn(feed.url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      'User-Agent': 'RedDevilsDaily/1.0 (RSS news aggregator; links to original articles)'
    }
  });
  if (!response.ok) throw new Error(`${feed.id}: HTTP ${response.status}`);
  const xml = await response.text();
  if (xml.length > 2_000_000) throw new Error('RSS feed too large');
  return parseRss(xml, feed);
}
