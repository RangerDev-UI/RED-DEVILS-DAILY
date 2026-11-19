const REFRESH_MS = 10 * 60 * 1000;
const LIVE_REFRESH_MS = 45_000;
const NEAR_KICKOFF_REFRESH_MS = 90_000;
const STANDINGS_REFRESH_MS = 30 * 60 * 1000;
const FALLBACK = {
  image: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Old_Trafford_outside_20060726_1.jpg',
  original: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Old_Trafford_outside_20060726_1.jpg',
  title: 'Old Trafford, Manchester',
  url: 'https://commons.wikimedia.org/wiki/File:Old_Trafford_outside_20060726_1.jpg',
  author: 'André Zahn',
  license: 'CC BY-SA 2.0 DE',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/de/deed.en',
  width: 1024,
  height: 683
};

const categories = {
  all: 'ทั้งหมด', club: 'ข่าวสโมสร', transfers: 'ตลาดนักเตะ',
  matches: 'การแข่งขัน', players: 'นักเตะ'
};

const state = {
  articles: [], photos: [], loading: false, loadedOnce: false,
  filter: 'all', search: '', visible: 12, galleryVisible: 11, photoFilter: 'all', heroIndex: 0, bookmarks: [], nextRefreshAt: Date.now() + REFRESH_MS, nextMatchRefreshAt: Date.now() + REFRESH_MS, nextStandingsRefreshAt: Date.now() + STANDINGS_REFRESH_MS, matchLoading: false, standingsLoading: false,
  updatedAt: null, errors: [], sources: [], activePhoto: null, activePhotoIndex: 0, photoFallback: false, newsFailed: false, photosFailed: false, matchesFailed: false, matches: null, standingsFailed: false, standings: null, photosUpdatedAt: null, dataHealth: null
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (input = '') => String(input).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);
const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return /^(https?:)$/.test(url.protocol) ? url.href : '#';
  } catch { return '#'; }
};

const BOOKMARK_STORAGE_KEY = 'red-devils-daily:bookmarks:v1';
function readBookmarks() {
  try {
    const stored = JSON.parse(localStorage.getItem(BOOKMARK_STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter(a => a && safeUrl(a.url) !== '#' && typeof a.title === 'string')
      .slice(0, 100).map(a => ({ url: a.url, title: a.title, summary: a.summary || '', source: a.source || 'ข่าวที่บันทึก',
        category: a.category || 'club', publishedAt: a.publishedAt || null, savedAt: a.savedAt || '' }));
  } catch { return []; }
}
state.bookmarks = readBookmarks();
function isSaved(url) { return state.bookmarks.some(a => a.url === url); }
function toggleBookmark(url) {
  const article = [...state.articles, ...state.bookmarks].find(a => a.url === url);
  if (!article) return;
  state.bookmarks = isSaved(url)
    ? state.bookmarks.filter(a => a.url !== url)
    : [{ url: article.url, title: article.title, summary: article.summary || '', source: article.source,
      category: article.category, publishedAt: article.publishedAt, savedAt: new Date().toISOString() }, ...state.bookmarks].slice(0, 100);
  try { localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(state.bookmarks)); } catch { /* Storage may be disabled */ }
  leadStory(); renderNews();
}
function newIn24Hours(date) {
  const age = Date.now() - new Date(date).getTime();
  return Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60 * 1000;
}
function bookmarkButton(article) {
  const saved = isSaved(article.url);
  return `<button class="bookmark-button ${saved ? 'is-saved' : ''}" type="button" data-save-url="${escapeHtml(safeUrl(article.url))}" aria-pressed="${saved}" aria-label="${saved ? 'ยกเลิกบันทึกข่าว' : 'บันทึกข่าวไว้อ่าน'}" title="${saved ? 'นำออกจากรายการบันทึก' : 'บันทึกไว้ในเครื่องนี้'}">${saved ? '★' : '☆'} <span>${saved ? 'บันทึกแล้ว' : 'บันทึก'}</span></button>`;
}
function todayText() {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }).format(new Date());
}
function relativeTime(raw) {
  if (!raw) return 'ไม่ระบุเวลา';
  const diff = Math.floor((Date.now() - new Date(raw).getTime()) / 60_000);
  if (!Number.isFinite(diff)) return 'ไม่ระบุเวลา';
  if (diff < 0) return 'เพิ่งเผยแพร่';
  if (diff < 1) return 'เมื่อสักครู่';
  const rtf = new Intl.RelativeTimeFormat('th-TH', { numeric: 'auto', style: 'long' });
  if (diff < 60) return rtf.format(-diff, 'minute');
  if (diff < 1440) return rtf.format(-Math.floor(diff / 60), 'hour');
  if (diff < 43200) return rtf.format(-Math.floor(diff / 1440), 'day');
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(raw));
}
function categoryName(key) { return categories[key] ?? categories.club; }
function englishText(text) { return !/[ก-๙]/.test(text || ''); }
function imageFor(article, index = 0) {
  if (article.image && safeUrl(article.image) !== '#') {
    return { image: article.image, url: article.url, author: article.source, license: 'ภาพจากต้นทาง', isSource: true };
  }
  const photos = state.photos.length ? state.photos : [FALLBACK];
  return photos[Math.abs(index * 7 + 3) % photos.length];
}
function imageTag(photo, alt, priority = false) {
  return `<img src="${escapeHtml(safeUrl(photo.image))}" alt="${escapeHtml(alt)}" loading="${priority ? 'eager' : 'lazy'}" ${priority ? 'fetchpriority="high"' : ''} referrerpolicy="no-referrer" />`;
}
function creditLink(photo, label = 'ภาพประกอบ') {
  const caption = photo.isSource ? `ภาพ: ${photo.author}` : `${label}: ${photo.author || 'Wikimedia'} · ${photo.license || 'CC'}`;
  return `<a class="photo-disclaimer" href="${escapeHtml(safeUrl(photo.url))}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(caption)}" onclick="event.stopPropagation()">${escapeHtml(caption.slice(0, 52))}</a>`;
}
function leadStory() {
  const el = $('#leadStory');
  if (!state.articles.length) {
    el.innerHTML = `<div class="lead-image placeholder-image"></div><div class="lead-content"><span class="story-label">RED DEVILS DAILY</span><h2>ALL THINGS UNITED.</h2><p>${state.loadedOnce ? 'ยังไม่สามารถดึงข่าวล่าสุดได้ในขณะนี้ เปิดอ่านข่าวโดยตรงได้จากแหล่งข่าวด้านล่าง' : 'กำลังโหลดข่าวล่าสุดและรูปภาพ...'}</p><a class="lead-action" href="https://www.manutd.com/en/news" target="_blank" rel="noopener noreferrer">ดูข่าวเว็บไซต์สโมสร <span>↗</span></a></div><a class="lead-photo-credit" href="${FALLBACK.url}" target="_blank" rel="noopener noreferrer">ภาพ: André Zahn · CC BY-SA 2.0 DE</a>`;
    return;
  }
  const index = Math.min(state.heroIndex, state.articles.length - 1);
  const article = state.articles[index];
  const image = imageFor(article, index);
  const heroTotal = Math.min(state.articles.length, 4);
  el.innerHTML = `<div class="lead-image" style="background-image:url('${escapeHtml(safeUrl(image.image))}')"></div><a class="lead-photo-credit" href="${escapeHtml(safeUrl(image.url))}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(image.license || '')}">${image.isSource ? 'ภาพข่าว' : 'ภาพประกอบ'}: ${escapeHtml((image.author || 'Wikimedia').slice(0, 35))}</a><div class="lead-content"><span class="story-label">TOP STORY / ${escapeHtml(categoryName(article.category).toUpperCase())}</span><h2 class="${englishText(article.title) ? 'english' : ''}">${escapeHtml(article.title)}</h2><p>${escapeHtml(article.summary || 'อ่านรายละเอียดของข่าวนี้ได้จากสำนักข่าวต้นฉบับ')}</p><div class="lead-meta">${escapeHtml(article.source)} <b>•</b> ${escapeHtml(relativeTime(article.publishedAt))}</div><div class="lead-actions"><a class="lead-action" href="${escapeHtml(safeUrl(article.url))}" target="_blank" rel="noopener noreferrer">อ่านข่าวต้นฉบับ <span>↗</span></a>${bookmarkButton(article)}</div></div><div class="hero-controls" aria-label="เลื่อนข่าวเด่น"><button type="button" data-hero-step="-1" aria-label="ข่าวเด่นก่อนหน้า" ${heroTotal < 2 ? 'disabled' : ''}>‹</button><span>${String(index + 1).padStart(2, '0')} / ${String(heroTotal).padStart(2, '0')}</span><button type="button" data-hero-step="1" aria-label="ข่าวเด่นถัดไป" ${heroTotal < 2 ? 'disabled' : ''}>›</button></div>`;
}
function featuredStories() {
  const featured = state.articles.slice(1, 3);
  $('#featuredStories').innerHTML = featured.length ? featured.map((article, i) => {
    const photo = imageFor(article, i + 1);
    return `<a class="featured-item" href="${escapeHtml(safeUrl(article.url))}" target="_blank" rel="noopener noreferrer"><div class="featured-thumb">${imageTag(photo, 'ภาพประกอบข่าว ' + article.title)}</div><div class="featured-info"><span class="featured-cat">${escapeHtml(categoryName(article.category))}</span><div class="featured-title ${englishText(article.title) ? 'en' : ''}">${escapeHtml(article.title)}</div><div class="featured-meta">${escapeHtml(article.source)} <span>·</span> ${escapeHtml(relativeTime(article.publishedAt))}</div></div></a>`;
  }).join('') : '<div class="featured-placeholder loading-glow"></div><div class="featured-placeholder loading-glow"></div>';
}
function filteredArticles() {
  const search = state.search.toLowerCase();
  const articles = state.filter === 'saved' ? state.bookmarks : state.articles;
  return articles.filter(article =>
    (state.filter === 'all' || state.filter === 'saved' || article.category === state.filter) &&
    (!search || `${article.title} ${article.summary} ${article.source}`.toLowerCase().includes(search))
  );
}
function renderNews() {
  const all = filteredArticles();
  const visible = all.slice(0, state.visible);
  $('#showMore').hidden = visible.length >= all.length;
  $('#savedCount').textContent = state.bookmarks.length;
  $('#newsUpdatedBadge').textContent = state.filter === 'saved' ? `${all.length} ข่าวที่บันทึกไว้ในเบราว์เซอร์` :
    state.loadedOnce ? `${all.length} ข่าวจากแหล่งข่าวจริง` : 'กำลังอัปเดตข้อมูล';
  if (!visible.length) {
    $('#newsGrid').innerHTML = `<div class="empty-state"><strong>${state.filter === 'saved' ? 'ยังไม่มีข่าวที่บันทึกไว้' : state.loadedOnce ? 'ยังไม่มีข่าวในหมวดนี้' : 'กำลังโหลดข่าว...'}</strong><p>${state.filter === 'saved' ? 'กดปุ่ม ☆ บันทึก ในการ์ดข่าวที่สนใจ แล้วกลับมาอ่านที่นี่ได้' : state.search || state.filter !== 'all' ? 'ลองเปลี่ยนหมวดหมู่หรือคำค้นหาเพื่อดูข่าวเพิ่มเติม' : 'หากแหล่งข่าวตอบกลับช้า สามารถอ่านข่าวตรงจากเว็บไซต์ของสโมสรได้'}</p><a href="https://www.manutd.com/en/news" target="_blank" rel="noopener noreferrer">ไปที่ ManUtd.com ↗</a></div>`;
    return;
  }
  $('#newsGrid').innerHTML = visible.map((article, index) => {
    const photo = imageFor(article, index);
    return `<article class="news-card"><div class="card-image">${imageTag(photo, `ภาพประกอบเกี่ยวกับแมนยู สำหรับหัวข้อ ${article.title}`)}<span class="card-sequence">${String(index + 1).padStart(2, '0')}</span>${newIn24Hours(article.publishedAt) ? '<span class="news-fresh">ใหม่ใน 24 ชม.</span>' : ''}${creditLink(photo)}</div><div class="news-card-body"><div class="card-topline"><span class="card-cat">${escapeHtml(categoryName(article.category).toUpperCase())}</span><span class="card-meta">${escapeHtml(relativeTime(article.publishedAt))}</span></div><h3 class="card-title ${englishText(article.title) ? 'en' : ''}"><a href="${escapeHtml(safeUrl(article.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title)}</a></h3>${article.summary ? `<p class="card-summary">${escapeHtml(article.summary)}</p>` : ''}<div class="card-bottom"><span class="card-meta">${escapeHtml(article.source)}</span><div class="card-actions">${bookmarkButton(article)}<a href="${escapeHtml(safeUrl(article.url))}" target="_blank" rel="noopener noreferrer" class="card-read">READ STORY <span>↗</span></a></div></div></div></article>`;
  }).join('');
}
function renderGallery() {
  const allPhotos = state.photos.length ? state.photos : [];
  const players = allPhotos.filter(photo => photo.topic === 'players');
  const filtered = state.photoFilter === 'players' ? players : allPhotos;
  const photos = (filtered.length ? filtered.slice(0, state.galleryVisible) : state.photoFilter === 'all' ? [FALLBACK] : []);
  $('#playerPhotoCount').textContent = `(${players.length})`;
  $('#photoCount').textContent = state.photos.length ? String(state.photos.length).padStart(2, '0') : '01';
  $('#photoWall').innerHTML = photos.length ? photos.map((photo, i) =>
    `<button type="button" class="photo-tile" data-photo="${i}" aria-label="ดูภาพ ${escapeHtml(photo.title || 'แมนยู')} และเครดิต"><img src="${escapeHtml(safeUrl(photo.image))}" alt="${escapeHtml(photo.title || 'ภาพเกี่ยวกับแมนเชสเตอร์ ยูไนเต็ด')}" loading="lazy" referrerpolicy="no-referrer"/><span class="tile-corner">↗</span><span class="tile-info"><small>${i === 0 ? 'FEATURED FRAME' : `FRAME / ${String(i + 1).padStart(2, '0')}`}</small><strong>${escapeHtml(photo.title || 'UNITED MOMENTS')}</strong></span></button>`
  ).join('') : `<div class="gallery-empty">ยังไม่พบภาพนักเตะที่เผยแพร่ภายใต้สัญญาอนุญาตที่รองรับจาก Wikimedia Commons ในขณะนี้ <a href="https://commons.wikimedia.org/wiki/Category:Players_of_Manchester_United_F.C." target="_blank" rel="noopener noreferrer">ดูภาพที่ Wikimedia Commons ↗</a></div>`;
  state.displayPhotos = photos;
  $('#galleryMore').hidden = filtered.length <= photos.length;
}

function openPhoto(index) {
  const photo = state.displayPhotos?.[index];
  if (!photo) return;
  state.activePhoto = photo;
  state.activePhotoIndex = index;
  $('#lightboxPrev').disabled = state.displayPhotos.length < 2;
  $('#lightboxNext').disabled = state.displayPhotos.length < 2;
  $('#lightboxImg').src = safeUrl(photo.original || photo.image);
  $('#lightboxImg').alt = photo.title || 'ภาพประกอบแมนเชสเตอร์ ยูไนเต็ด';
  $('#lightboxTitle').textContent = photo.title || 'United Moments';
  $('#lightboxCredit').textContent = `ภาพโดย ${photo.author || 'Wikimedia Commons contributor'} · ${photo.license || 'Free license'} · ภาพประกอบ ไม่ใช่ภาพจากข่าวล่าสุดเสมอไป`;
  $('#lightboxSource').href = safeUrl(photo.url);
  $('#lightboxLicense').href = safeUrl(photo.licenseUrl || photo.url);
  $('#photoLightbox').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#closeLightbox').focus();
}
function changePhoto(offset) {
  if ($('#photoLightbox').hidden || state.displayPhotos.length < 2) return;
  openPhoto((state.activePhotoIndex + offset + state.displayPhotos.length) % state.displayPhotos.length);
}
function closePhoto() {
  $('#photoLightbox').hidden = true;
  document.body.style.overflow = '';
  state.activePhoto = null;
}
const MANCHESTER_UNITED_CREST = 'https://a.espncdn.com/i/teamlogos/soccer/500/360.png';
function safeTeamCrest(input) {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && url.hostname === 'a.espncdn.com' &&
      /^\/i\/teamlogos\/soccer\/(?:500|100)\/\d{1,9}\.png$/.test(url.pathname) ? url.href : '';
  } catch { return ''; }
}
function teamInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return words.length > 1 ? words.slice(0, 2).map(word => word[0]).join('').toUpperCase() : (words[0] || 'FC').slice(0, 3).toUpperCase();
}
function teamBadge(url, initials) {
  const src = safeTeamCrest(url);
  return `<span class="team-badge" aria-hidden="true"><span class="team-badge-fallback">${escapeHtml(initials)}</span>${src ? `<img class="team-logo-image" src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async">` : ''}</span>`;
}
function matchClub(match, united) {
  const name = united ? 'MAN UTD' : (match.opponent || 'คู่แข่ง');
  const logo = united ? (match.logoUnited || MANCHESTER_UNITED_CREST) : match.logoOpponent;
  return `<span class="match-club">${teamBadge(logo, united ? 'MU' : teamInitials(name))}<strong>${escapeHtml(name)}</strong></span>`;
}
function matchResultPair(match) {
  const home = match.home ? matchClub(match, true) : matchClub(match, false);
  const away = match.home ? matchClub(match, false) : matchClub(match, true);
  return `<span class="result-team-pair">${home}<span class="result-dash">—</span>${away}</span>`;
}
// Show initials rather than a broken-image icon if ESPN has no crest for a team.
document.addEventListener('error', event => {
  if (event.target instanceof HTMLImageElement && event.target.classList.contains('team-logo-image')) {
    event.target.hidden = true;
  }
}, true);

function matchDate(raw, options = {}) {
  if (!raw || !Number.isFinite(new Date(raw).getTime())) return 'ยังไม่ระบุเวลา';
  return new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', ...options }).format(new Date(raw));
}
function matchScore(match) {
  if (match.scoreUnited == null || match.scoreOpponent == null) return '— : —';
  return match.home ? `${escapeHtml(match.scoreUnited)} : ${escapeHtml(match.scoreOpponent)}` : `${escapeHtml(match.scoreOpponent)} : ${escapeHtml(match.scoreUnited)}`;
}
function matchPair(match) {
  return match.home ? `${matchClub(match, true)}<span class="versus">VS</span>${matchClub(match, false)}` : `${matchClub(match, false)}<span class="versus">VS</span>${matchClub(match, true)}`;
}
function matchEmpty(text) { return `<p class="match-placeholder">${escapeHtml(text)}</p>`; }
function renderMatches() {
  const data = state.matches;
  const live = data?.live || [];
  const fixtures = data?.upcoming || [];
  const results = data?.results || [];
  const next = live[0] || fixtures[0];
  const info = data?.sourceUrl && safeUrl(data.sourceUrl) !== '#' ? safeUrl(data.sourceUrl) : 'https://www.espn.com/soccer/team/fixtures/_/id/360';
  $('#matchSynced').textContent = data?.updatedAt ? `· ${matchDate(data.updatedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} น.` : '· ยังไม่อัปเดต';
  $('#nextMatch').innerHTML = next ? `<div class="next-match-top"><span class="match-kicker">${next.status === 'live' ? 'กำลังแข่งขัน · ข้อมูลอาจล่าช้า' : 'NEXT MATCH / นัดต่อไป'}</span><span class="match-league">${escapeHtml(next.competition)}</span></div><div class="next-match-crest-tag">RED DEVILS / FIXTURE <span>↗</span></div><div class="next-match-versus">${matchPair(next)}</div><div class="next-match-time">${matchDate(next.date, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} น. · เวลาไทย</div>${next.status === 'live' ? `<div class="next-match-score">${matchScore(next)} <small>LIVE</small></div>` : ''}<div class="next-match-bottom"><span>${escapeHtml(next.venue || 'รอข้อมูลสนาม')}</span><a href="${escapeHtml(safeUrl(next.url))}" target="_blank" rel="noopener noreferrer">รายละเอียดการแข่งขัน ↗</a></div>` : `<div class="match-missing"><span class="match-kicker">NEXT MATCH</span><h3>รอข้อมูลโปรแกรมการแข่งขัน</h3><p>ยังไม่พบโปรแกรมแข่งแมนยูจากแหล่งข้อมูลที่เชื่อมต่อ ไม่แสดงตารางสมมุติ</p><a href="${escapeHtml(info)}" target="_blank" rel="noopener noreferrer">ดูโปรแกรมบน ESPN ↗</a></div>`;
  $('#matchResults').innerHTML = results.length ? results.map(m => `<a class="result-line" href="${escapeHtml(safeUrl(m.url))}" target="_blank" rel="noopener noreferrer"><span><small>${escapeHtml(m.competition)} · ${matchDate(m.date, { day: 'numeric', month: 'short' })}</small><strong class="result-teams">${matchResultPair(m)}</strong></span><b>${matchScore(m)}</b></a>`).join('') : matchEmpty('ยังไม่พบผลการแข่งขันที่ยืนยันแล้ว');
  $('#fixtureList').innerHTML = fixtures.length ? fixtures.map(m => `<a class="fixture-item" href="${escapeHtml(safeUrl(m.url))}" target="_blank" rel="noopener noreferrer"><span class="fixture-date"><strong>${matchDate(m.date, {day: '2-digit'})}</strong><small>${matchDate(m.date, {month: 'short'})}</small></span><span class="fixture-main"><small>${escapeHtml(m.competition)} · ${m.home ? 'เหย้า' : 'เยือน'}</small><span>${matchPair(m)}</span></span><span class="fixture-time">${matchDate(m.date, { hour: '2-digit', minute: '2-digit' })} น.</span><span class="fixture-arrow">↗</span></a>`).join('') : matchEmpty('ยังไม่มีโปรแกรมในข้อมูลที่ได้รับ ลองดูจากแหล่งข่าวต้นฉบับ');
  const warning = state.matchesFailed || data?.partial || data?.stale || !data?.hasData;
  $('#matchFeedHealth').classList.toggle('has-warning', Boolean(warning));
  $('#matchFeedHealth').textContent = state.matchesFailed ? 'ไม่สามารถเชื่อมต่อข้อมูลการแข่งขันได้ ข้อมูลเดิมอาจไม่ใช่ล่าสุด' :
    data?.stale ? 'กำลังแสดงตารางเดิมที่บันทึกไว้ เพราะแหล่งข้อมูลตอบกลับไม่ได้' :
    data?.partial ? 'ข้อมูลจากบางรายการยังไม่พร้อม โปรแกรมอาจไม่ครบทุกถ้วย · โปรดตรวจสอบเวลาจากต้นทางก่อนเดินทาง' :
    !data?.hasData ? 'ยังไม่มีข้อมูลจาก ESPN ในขณะนี้ (ระบบไม่ได้สร้างสกอร์จำลอง)' :
    'เวลาแข่งขันแสดงตามเวลาไทย · ข้อมูลอาจล่าช้าและโปรแกรมเปลี่ยนได้ กรุณายืนยันกับแหล่งข่าวก่อนใช้งาน';
}
function isKickoffNear(data, now = Date.now()) {
  return Boolean((data?.upcoming || []).some(m => {
    const delta = new Date(m.date).getTime() - now;
    return delta < 35 * 60_000 && delta > -3 * 60 * 60_000;
  }));
}
function matchRefreshDelay() {
  return state.matches?.live?.length ? LIVE_REFRESH_MS : isKickoffNear(state.matches) ? NEAR_KICKOFF_REFRESH_MS : REFRESH_MS;
}
function renderStandings() {
  const data = state.standings;
  $('#standingsSynced').textContent = data?.updatedAt ? 'เช็ก ' + matchDate(data.updatedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' น.' : 'ยังไม่ยืนยันข้อมูล';
  $('#standingsSeason').textContent = data?.season ? 'ฤดูกาล ' + data.season : 'พรีเมียร์ลีก';
  const groups = Array.isArray(data?.groups) ? data.groups : [];
  const rows = groups.flatMap((group, groupIndex) => [
    ...(groups.length > 1 ? [`<tr class="standings-group"><td colspan="10">${escapeHtml(group.name)}</td></tr>`] : []),
    ...(Array.isArray(group.rows) ? group.rows : []).map(team => {
      const cls = team.id === '360' ? 'is-united' : '';
      const logo = safeTeamCrest(team.logo);
      const name = escapeHtml(team.name);
      const number = val => val == null || !Number.isFinite(Number(val)) ? '—' : escapeHtml(String(val));
      return `<tr class="${cls}"><td>${number(team.rank)}</td><th scope="row" class="table-team-name"><span class="league-club">${teamBadge(logo, teamInitials(name))}<span>${name}</span>${team.id === '360' ? '<b>MU</b>' : ''}</span></th><td>${number(team.played)}</td><td>${number(team.won)}</td><td>${number(team.drawn)}</td><td>${number(team.lost)}</td><td>${number(team.gf)}</td><td>${number(team.ga)}</td><td>${team.gd > 0 ? '+' + number(team.gd) : number(team.gd)}</td><td class="league-points">${number(team.points)}</td></tr>`;
    })
  ]);
  $('#standingsBody').innerHTML = rows.length ? rows.join('') : `<tr><td colspan="10" class="standings-loading">ยังไม่สามารถยืนยันตารางคะแนนฤดูกาลปัจจุบันได้ กรุณาดูต้นทาง ESPN</td></tr>`;
  $('#standingsHealth').textContent = state.standingsFailed ? 'การเชื่อมต่อตารางคะแนนล้มเหลว ข้อมูลเดิมอาจไม่ล่าสุด' : data?.stale ? 'กำลังแสดงตารางคะแนนเดิม เพราะต้นทางไม่ตอบกลับ' : rows.length ? 'ตารางคะแนนจาก ESPN · อาจเปลี่ยนหลังจบแมตช์ กรุณายืนยันจากต้นทาง' : 'ยังไม่พบข้อมูลยืนยันจากแหล่งที่มา';
  $('#standingsHealth').classList.toggle('has-warning', state.standingsFailed || Boolean(data?.stale) || !rows.length);
}
function renderDataHealth() {
  const now = Date.now();
  const checks = [
    { name: 'ข่าว', checked: state.updatedAt, failed: state.newsFailed || state.errors.length > 0, available: state.articles.length > 0, maxAge: 25*60_000 },
    { name: 'รูปภาพ', checked: state.photosUpdatedAt, failed: state.photosFailed, available: state.photos.length > 0, maxAge: 35*60_000 },
    { name: 'การแข่งขัน', checked: state.matches?.updatedAt, failed: state.matchesFailed || state.matches?.partial || state.matches?.stale, available: state.matches?.hasData, maxAge: 25*60_000 },
    { name: 'ตารางคะแนน', checked: state.standings?.updatedAt, failed: state.standingsFailed || state.standings?.stale, available: state.standings?.hasData, maxAge: 2*3600_000 }
  ];
  let warnings = 0;
  $('#healthGrid').innerHTML = checks.map(item => {
    const t = new Date(item.checked || '').getTime();
    const ageMs = Number.isFinite(t) ? now - t : Infinity;
    const stateName = !item.available || ageMs > item.maxAge ? 'bad' : item.failed ? 'warn' : 'good';
    if (stateName !== 'good') warnings++;
    const label = stateName === 'bad' ? 'ไม่มีข้อมูลใหม่ที่ยืนยันได้' : stateName === 'warn' ? 'ข้อมูลบางส่วนไม่พร้อม' : 'เชื่อมต่อปกติ';
    return `<div class="health-card ${stateName}"><span class="health-dot"></span><strong>${item.name}</strong><span>${label}</span><small>ตรวจสอบ: ${item.checked ? matchDate(item.checked, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' น.' : 'ยังไม่ได้ข้อมูล'}</small></div>`;
  }).join('');
  $('#healthOverall').textContent = !state.loadedOnce ? 'กำลังตรวจ...' : warnings ? `พบ ${warnings} รายการต้องตรวจสอบ` : 'แหล่งข้อมูลตอบกลับปกติ';
  $('#healthOverall').classList.toggle('has-warning', Boolean(warnings));
  $('#liveCadence').textContent = state.matches?.live?.length ? 'กำลังแข่ง · เช็กทุก 45 วินาที' : isKickoffNear(state.matches) ? 'ใกล้แข่ง · เช็กทุก 90 วินาที' : 'เช็กทุก 10 นาที';
}
function renderMatchNews() {
  const before = /preview|pre.match|build.up|predicted|line.up|team news|kick.off|ahead of|ก่อนเกม|พรีวิว|คาดการณ์|จัดทัพ|ตัวจริง|เตรียมพบ|ก่อนพบ/i;
  const after = /match report|full.time|reaction|highlights|post.match|beats?|defeats?|draws?|wins?|results?|score|recap|หลังเกม|ผลบอล|จบเกม|พ่าย|เอาชนะ|ไฮไลท์|เสมอ/i;
  const items = state.articles.filter(a => a.category === 'matches' || before.test(a.title) || after.test(a.title));
  const toHtml = (articles, query) => articles.length ? articles.slice(0, 3).map(a => `<a href="${escapeHtml(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(a.title)}</span><small>${escapeHtml(a.source)} · ${escapeHtml(relativeTime(a.publishedAt))}</small></a>`).join('') : `<p>ยังไม่พบหัวข้อข่าวประเภทนี้จาก RSS</p><a class="match-external" href="${escapeHtml(query)}" target="_blank" rel="noopener noreferrer">ค้นหาข่าวเพิ่มเติม ↗</a>`;
  $('#preMatchNews').innerHTML = toHtml(items.filter(a => before.test(a.title)), 'https://news.google.com/search?q=Manchester%20United%20match%20preview');
  $('#postMatchNews').innerHTML = toHtml(items.filter(a => after.test(a.title)), 'https://news.google.com/search?q=Manchester%20United%20match%20report');
}

function renderHeader() {
  $('#articleCount').textContent = String(state.articles.length).padStart(2, '0');
  $('#sourceCount').textContent = String(state.sources.length || 4).padStart(2, '0');
  $('#lastUpdated').textContent = state.updatedAt
    ? new Intl.DateTimeFormat('th-TH', { timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(state.updatedAt)) + ' น.'
    : 'ยังไม่มีข้อมูล';
  const warning = state.newsFailed || state.photosFailed || state.errors.length > 0;
  const message = state.newsFailed && state.photosFailed ? 'เชื่อมต่อแหล่งข่าวและภาพไม่ได้ กำลังแสดงข้อมูลเดิมหากมี' :
    state.newsFailed ? 'ข่าวยังอัปเดตไม่สำเร็จ กำลังแสดงข้อมูลเดิมหากมี' :
    state.photosFailed ? 'คลังภาพตอบกลับช้า ข่าวยังอัปเดตตามปกติ' :
    state.errors.length ? `แหล่งข่าวบางแห่ง (${state.errors.length}) ตอบกลับไม่ได้ กำลังแสดงข่าวจากแหล่งอื่น` :
    'เชื่อมต่อแหล่งข่าวและคลังภาพสำเร็จ';
  $('#syncHealth').textContent = message;
  $('#syncHealth').classList.toggle('has-warning', warning);
  $('#feedNotice').hidden = !warning;
  $('#feedNotice').textContent = message;
}
function renderAll() {
  leadStory(); featuredStories(); renderNews(); renderMatches(); renderMatchNews(); renderStandings(); renderGallery(); renderHeader(); renderDataHealth();
}
function updateCountdown() {
  const timeLeft = Math.max(0, state.nextRefreshAt - Date.now());
  const m = String(Math.floor(timeLeft / 60000)).padStart(2, '0');
  const s = String(Math.floor((timeLeft % 60000) / 1000)).padStart(2, '0');
  $('#nextUpdate').textContent = `${m}:${s}`;
  $('#refreshProgress').style.width = `${Math.max(0, timeLeft / REFRESH_MS) * 100}%`;
}
async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}
async function refresh() {
  if (state.loading) return;
  state.loading = true;
  $('#headerRefresh').classList.add('spinning');
  const results = await Promise.allSettled([fetchJson('/api/news'), fetchJson('/api/photos'), fetchJson('/api/matches'), fetchJson('/api/standings')]);
  state.newsFailed = results[0].status === 'rejected';
  state.photosFailed = results[1].status === 'rejected';
  state.matchesFailed = results[2].status === 'rejected';
  state.standingsFailed = results[3].status === 'rejected';
  if (results[0].status === 'fulfilled' && Array.isArray(results[0].value.articles)) {
    state.articles = results[0].value.articles;
    state.updatedAt = results[0].value.updatedAt;
    state.errors = results[0].value.errors || [];
    state.sources = results[0].value.sources || [];
  }
  if (results[1].status === 'fulfilled' && Array.isArray(results[1].value.photos)) {
    state.photos = results[1].value.photos;
    state.photosUpdatedAt = results[1].value.updatedAt || null;
  }
  if (results[2].status === 'fulfilled') state.matches = results[2].value;
  if (results[3].status === 'fulfilled') state.standings = results[3].value;
  state.nextMatchRefreshAt = Date.now() + matchRefreshDelay();
  state.nextStandingsRefreshAt = Date.now() + STANDINGS_REFRESH_MS;
  state.loadedOnce = true;
  state.nextRefreshAt = Date.now() + REFRESH_MS;
  state.loading = false;
  $('#headerRefresh').classList.remove('spinning');
  renderAll(); updateCountdown();
}

async function refreshMatchesOnly() {
  if (state.loading || state.matchLoading) return;
  state.matchLoading = true;
  try {
    const data = await fetchJson('/api/matches');
    state.matches = data;
    state.matchesFailed = false;
  } catch { state.matchesFailed = true; }
  finally {
    state.matchLoading = false;
    state.nextMatchRefreshAt = Date.now() + matchRefreshDelay();
    renderMatches(); renderDataHealth();
  }
}
async function refreshStandingsOnly() {
  if (state.loading || state.standingsLoading) return;
  state.standingsLoading = true;
  try { state.standings = await fetchJson('/api/standings'); state.standingsFailed = false; }
  catch { state.standingsFailed = true; }
  finally {
    state.standingsLoading = false;
    state.nextStandingsRefreshAt = Date.now() + STANDINGS_REFRESH_MS;
    renderStandings(); renderDataHealth();
  }
}
function refreshIfNeeded() {
  if (document.hidden) return;
  const now = Date.now();
  if (now >= state.nextRefreshAt) { refresh(); return; }
  if (now >= state.nextMatchRefreshAt) refreshMatchesOnly();
  if (now >= state.nextStandingsRefreshAt) refreshStandingsOnly();
}
function init() {
  $('#todayLabel').textContent = todayText();
  $('#categoryTabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.filter = button.dataset.category;
    state.visible = 12;
    document.querySelectorAll('.filter-tab').forEach(b => {
      b.classList.toggle('active', b === button);
      b.setAttribute('aria-pressed', String(b === button));
    });
    renderNews();
  });
  $('#searchInput').addEventListener('input', (event) => {
    state.search = event.target.value.trim(); state.visible = 12; renderNews();
  });
  $('#showMore').addEventListener('click', () => { state.visible += 9; renderNews(); });
  $('#galleryMore').addEventListener('click', () => { state.galleryVisible += 12; renderGallery(); });
  $('#photoFilterTabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-photo-filter]');
    if (!button) return;
    state.photoFilter = button.dataset.photoFilter === 'players' ? 'players' : 'all';
    state.galleryVisible = 11;
    document.querySelectorAll('.photo-filter-button').forEach(b => {
      b.classList.toggle('active', b === button);
      b.setAttribute('aria-pressed', String(b === button));
    });
    renderGallery();
  });
  const onSave = e => {
    const button = e.target.closest('[data-save-url]');
    if (button) { e.preventDefault(); toggleBookmark(button.dataset.saveUrl); }
  };
  $('#newsGrid').addEventListener('click', onSave);
  $('#leadStory').addEventListener('click', e => {
    onSave(e);
    const button = e.target.closest('[data-hero-step]');
    if (!button || state.articles.length < 2) return;
    const total = Math.min(state.articles.length, 4);
    state.heroIndex = (state.heroIndex + Number(button.dataset.heroStep) + total) % total;
    leadStory();
  });
  $('#headerRefresh').addEventListener('click', refresh);
  $('#photoWall').addEventListener('click', e => {
    const tile = e.target.closest('[data-photo]');
    if (tile) openPhoto(Number(tile.dataset.photo));
  });
  $('#closeLightbox').addEventListener('click', closePhoto);
  $('#lightboxPrev').addEventListener('click', () => changePhoto(-1));
  $('#lightboxNext').addEventListener('click', () => changePhoto(1));
  $('#photoLightbox').addEventListener('click', e => { if (e.target.dataset.close) closePhoto(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePhoto();
    if (!$('#photoLightbox').hidden && e.key === 'ArrowLeft') changePhoto(-1);
    if (!$('#photoLightbox').hidden && e.key === 'ArrowRight') changePhoto(1);
  });
  // Preserve visual fallback if external image servers are unreachable.
  document.addEventListener('error', e => { if (e.target?.tagName === 'IMG') e.target.style.opacity = '0'; }, true);
  $('#mobileMenu').addEventListener('click', () => {
    const isOpen = $('#mainNav').classList.toggle('open');
    $('#mobileMenu').setAttribute('aria-expanded', String(isOpen));
  });
  document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(item => item.classList.toggle('is-active', item === link));
    $('#mainNav').classList.remove('open');
    $('#mobileMenu').setAttribute('aria-expanded', 'false');
  }));
  setInterval(updateCountdown, 1000);
  setInterval(refreshIfNeeded, 10_000);
  setInterval(renderDataHealth, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshIfNeeded();
  });
  updateCountdown();
  refresh();
}
init();
