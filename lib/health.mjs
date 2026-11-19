/** Checks fetch freshness, provider failures and missing data independently. */
const age = (raw, now) => {
  const n = new Date(raw || '').getTime();
  return Number.isFinite(n) ? Math.max(0, now - n) : Infinity;
};
export function evaluateHealth(payloads, now = new Date()) {
  const t = new Date(now).getTime();
  const rules = [
    { id: 'news', title: 'ข่าว', maxMs: 25 * 60_000, list: 'articles' },
    { id: 'photos', title: 'รูปภาพ', maxMs: 35 * 60_000, list: 'photos' },
    { id: 'matches', title: 'การแข่งขัน', maxMs: 25 * 60_000, list: 'upcoming' },
    { id: 'standings', title: 'ตารางคะแนน', maxMs: 2 * 3600_000, list: 'groups' },
    { id: 'squad', title: 'นักเตะ', maxMs: 6 * 3600_000, list: 'players' },
    { id: 'transfers', title: 'ซื้อขาย', maxMs: 25 * 60_000, list: 'articles' }
  ];
  const services = rules.map(rule => {
    const data = payloads?.[rule.id];
    const checkedAgoMs = age(data?.updatedAt, t);
    const isMissing = !data || (rule.id === 'matches' ? data.hasData === false :
      rule.id === 'standings' || rule.id === 'squad' ? !data.hasData :
      rule.id === 'transfers' ? !Array.isArray(data.articles) : !Array.isArray(data[rule.list]) || data[rule.list].length === 0);
    const partial = Boolean(data?.partial || data?.stale || data?.error || (data?.errors?.length));
    const status = isMissing ? 'unavailable' : checkedAgoMs > rule.maxMs ? 'stale' : partial ? 'partial' : 'ok';
    return { id: rule.id, title: rule.title, status, checkedAt: data?.updatedAt || null,
      checkedAgoMs: Number.isFinite(checkedAgoMs) ? checkedAgoMs : null,
      note: status === 'ok' ? 'เชื่อมต่อสำเร็จ' : status === 'partial' ? 'บางแหล่งข้อมูลไม่พร้อม' :
        status === 'stale' ? 'ข้อมูลเก่ากว่าเกณฑ์' : 'ยังไม่มีข้อมูลยืนยันจากต้นทาง' };
  });
  const news = payloads?.news;
  const latestPublishedAt = (news?.articles || []).reduce((latest, a) => {
    const timestamp = new Date(a?.publishedAt || '').getTime();
    return Number.isFinite(timestamp) && timestamp > latest ? timestamp : latest;
  }, 0);
  const oldest = services.some(s => s.status === 'stale' || s.status === 'unavailable');
  return { status: oldest ? 'warning' : services.some(s => s.status === 'partial') ? 'partial' : 'ok',
    checkedAt: new Date(t).toISOString(), latestPublishedAt: latestPublishedAt ? new Date(latestPublishedAt).toISOString() : null,
    services, note: 'เวลาเช็กระบบไม่เท่ากับเวลาที่ต้นทางเผยแพร่ข่าว/ภาพ/ผลแข่ง' };
}
