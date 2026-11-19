/** Distinguish a primary-source club announcement from third-party reporting. */
import { FEEDS, loadRssFeed, deduplicate } from './feeds.mjs';
export const TRANSFER_FEEDS = [
  FEEDS.find(feed => feed.id === 'manutd'),
  { id: 'transfer-en', name: 'Google News · transfers', website: 'https://news.google.com/search?q=Manchester+United+transfer',
    url: 'https://news.google.com/rss/search?q=Manchester%20United%20transfer%20OR%20signing%20when%3A7d&hl=en-GB&gl=GB&ceid=GB%3Aen', focused: false },
  { id: 'transfer-th', name: 'Google News · ตลาดนักเตะ', website: 'https://news.google.com/search?q=แมนยู+ตลาดนักเตะ',
    url: 'https://news.google.com/rss/search?q=%E0%B9%81%E0%B8%A1%E0%B8%99%E0%B8%A2%E0%B8%B9%20%E0%B8%A2%E0%B9%89%E0%B8%B2%E0%B8%A2%E0%B8%97%E0%B8%B5%E0%B8%A1%20OR%20%E0%B9%80%E0%B8%8B%E0%B9%87%E0%B8%99%E0%B8%AA%E0%B8%B1%E0%B8%8D%E0%B8%8D%E0%B8%B2%20when%3A7d&hl=th&gl=TH&ceid=TH%3Ath', focused: false }
];
const transferRe = /\b(?:transfer|transfers|sign(?:s|ed|ing)?|signed|signing|loan|joins?|join(?:ed|ing)|depart(?:ure|s|ed)?|contract|deal|bid|target|linked|talks|interested|exit|move(?:s|d)?|window|rumou?r|extension|sell|sold|sale)\b|ย้ายทีม|เสริมทัพ|เซ็นสัญญา|สัญญาใหม่|ต่อสัญญา|ค่าตัว|ปล่อยยืม|ตลาด(?:ซื้อขาย|นักเตะ)|ซื้อขาย|เปิดตัว|คว้าตัว|เจรจา/iu;
const officialRe = /\b(?:has signed|have signed|signs|signed|completes signing|confirm(?:s|ed)? (?:the )?(?:signing|transfer|arrival|departure)|join(?:s|ed) (?:manchester )?united|new contract|contract extension|extend(?:s|ed)? (?:his|her|their)? ?contract|loan (?:move|deal) confirmed|departs? (?:united|the club)|leaves? united|announc(?:es|ed) (?:the )?(?:signing|transfer|arrival|departure))\b|ยืนยัน(?:การย้ายทีม|คว้าตัว|ต่อสัญญา)|ประกาศ(?:เซ็นสัญญา|คว้าตัว|ย้ายทีม|ต่อสัญญา)|เซ็นสัญญา(?:อย่างเป็นทางการ)?/iu;
const rumorRe = /\b(?:could|may|might|rumou?r(?:ed|s)?|reportedly|linked|target(?:s|ing)?|in talks|eyeing|keen on|set to|expected to|interested|possible|potential|bid for|considering|no deal|denied|not signed)\b|ลือ|จ่อ|เล็ง|คาด|สนใจ|รายงานว่า|มีข่าวว่า|อาจ|เจรจา/iu;
function isClubLink(url) { try {const u = new URL(url);return u.protocol === 'https:' && (u.hostname === 'manutd.com' || u.hostname === 'www.manutd.com');} catch { return false; } }
export function classifyTransfer(article) {
  const title = String(article?.title || '');
  const summary = String(article?.summary || '');
  const search = `${title} ${summary}`;
  if (!transferRe.test(search) && article?.category !== 'transfers') return null;
  // An article on the club's site is not itself proof of an official transfer.
  // The headline must state a specific, completed transaction without uncertainty.
  const club = article?.sourceId === 'manutd' && isClubLink(article?.url);
  const confirmed = club && officialRe.test(title) && !rumorRe.test(title);
  return confirmed ? 'club' : 'reported';
}
export async function loadTransfers(fetchFn = fetch, now = new Date()) {
  const results = await Promise.allSettled(TRANSFER_FEEDS.map(feed => loadRssFeed(feed, fetchFn)));
  const errors = results.flatMap((result, i) => result.status === 'rejected' ? [TRANSFER_FEEDS[i].name] : []);
  const articles = deduplicate(results.flatMap(result => result.status === 'fulfilled' ? result.value : []))
    .filter(article => classifyTransfer(article) !== null).slice(0, 32)
    .map(({ sourceImage, ...a }) => ({ ...a, transferStatus: classifyTransfer(a), image: null }));
  return { articles, clubCount: articles.filter(a => a.transferStatus === 'club').length,
    reportedCount: articles.filter(a => a.transferStatus === 'reported').length,
    updatedAt: new Date(now).toISOString(), sources: TRANSFER_FEEDS.map(f => f.name), partial: errors.length > 0, errors,
    hasData: articles.length > 0, note: 'ป้ายประกาศจากสโมสรใช้เฉพาะบทความจาก ManUtd.com ที่เข้าเงื่อนไขพาดหัวข่าว ไม่ใช่การตรวจข้อเท็จจริงอิสระ' };
}
