const REFRESH_MS = 10 * 60 * 1000;
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
  filter: 'all', search: '', visible: 12, nextRefreshAt: Date.now() + REFRESH_MS,
  updatedAt: null, errors: [], sources: [], activePhoto: null, photoFallback: false
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
  const article = state.articles[0];
  const image = imageFor(article, 0);
  el.innerHTML = `<div class="lead-image" style="background-image:url('${escapeHtml(safeUrl(image.image))}')"></div><a class="lead-photo-credit" href="${escapeHtml(safeUrl(image.url))}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(image.license || '')}">${image.isSource ? 'ภาพข่าว' : 'ภาพประกอบ'}: ${escapeHtml((image.author || 'Wikimedia').slice(0, 35))}</a><div class="lead-content"><span class="story-label">TOP STORY / ${escapeHtml(categoryName(article.category).toUpperCase())}</span><h2 class="${englishText(article.title) ? 'english' : ''}">${escapeHtml(article.title)}</h2><p>${escapeHtml(article.summary || 'อ่านรายละเอียดของข่าวนี้ได้จากสำนักข่าวต้นฉบับ')}</p><div class="lead-meta">${escapeHtml(article.source)} <b>•</b> ${escapeHtml(relativeTime(article.publishedAt))}</div><a class="lead-action" href="${escapeHtml(safeUrl(article.url))}" target="_blank" rel="noopener noreferrer">อ่านข่าวต้นฉบับ <span>↗</span></a></div>`;
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
  return state.articles.filter(article =>
    (state.filter === 'all' || article.category === state.filter) &&
    (!search || `${article.title} ${article.summary} ${article.source}`.toLowerCase().includes(search))
  );
}
function renderNews() {
  const all = filteredArticles();
  const visible = all.slice(0, state.visible);
  $('#showMore').hidden = visible.length >= all.length;
  $('#newsUpdatedBadge').textContent = state.loadedOnce ? `${all.length} ข่าวจากแหล่งข่าวจริง` : 'กำลังอัปเดตข้อมูล';
  if (!visible.length) {
    $('#newsGrid').innerHTML = `<div class="empty-state"><strong>${state.loadedOnce ? 'ยังไม่มีข่าวในหมวดนี้' : 'กำลังโหลดข่าว...'}</strong><p>${state.search || state.filter !== 'all' ? 'ลองเปลี่ยนหมวดหมู่หรือคำค้นหาเพื่อดูข่าวเพิ่มเติม' : 'หากแหล่งข่าวตอบกลับช้า สามารถอ่านข่าวตรงจากเว็บไซต์ของสโมสรได้'}</p><a href="https://www.manutd.com/en/news" target="_blank" rel="noopener noreferrer">ไปที่ ManUtd.com ↗</a></div>`;
    return;
  }
  $('#newsGrid').innerHTML = visible.map((article, index) => {
    const photo = imageFor(article, index);
    return `<article class="news-card"><div class="card-image">${imageTag(photo, `ภาพประกอบเกี่ยวกับแมนยู สำหรับหัวข้อ ${article.title}`)}<span class="card-sequence">${String(index + 1).padStart(2, '0')}</span>${creditLink(photo)}</div><div class="news-card-body"><div class="card-topline"><span class="card-cat">${escapeHtml(categoryName(article.category).toUpperCase())}</span><span class="card-meta">${escapeHtml(relativeTime(article.publishedAt))}</span></div><h3 class="card-title ${englishText(article.title) ? 'en' : ''}"><a href="${escapeHtml(safeUrl(article.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title)}</a></h3>${article.summary ? `<p class="card-summary">${escapeHtml(article.summary)}</p>` : ''}<div class="card-bottom"><span class="card-meta">${escapeHtml(article.source)}</span><a href="${escapeHtml(safeUrl(article.url))}" target="_blank" rel="noopener noreferrer" class="card-read">READ STORY <span>↗</span></a></div></div></article>`;
  }).join('');
}
function renderGallery() {
  const photos = state.photos.length ? state.photos.slice(0, 11) : [FALLBACK];
  $('#photoCount').textContent = state.photos.length ? String(state.photos.length).padStart(2, '0') : '01';
  $('#photoWall').innerHTML = photos.map((photo, i) =>
    `<button type="button" class="photo-tile" data-photo="${i}" aria-label="ดูภาพ ${escapeHtml(photo.title || 'แมนยู')} และเครดิต"><img src="${escapeHtml(safeUrl(photo.image))}" alt="${escapeHtml(photo.title || 'ภาพเกี่ยวกับแมนเชสเตอร์ ยูไนเต็ด')}" loading="lazy" referrerpolicy="no-referrer"/><span class="tile-corner">↗</span><span class="tile-info"><small>${i === 0 ? 'FEATURED FRAME' : `FRAME / ${String(i + 1).padStart(2, '0')}`}</small><strong>${escapeHtml(photo.title || 'UNITED MOMENTS')}</strong></span></button>`
  ).join('');
  state.displayPhotos = photos;
}
function openPhoto(index) {
  const photo = state.displayPhotos?.[index];
  if (!photo) return;
  state.activePhoto = photo;
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
function closePhoto() {
  $('#photoLightbox').hidden = true;
  document.body.style.overflow = '';
  state.activePhoto = null;
}
function renderHeader() {
  $('#articleCount').textContent = String(state.articles.length).padStart(2, '0');
  $('#sourceCount').textContent = String(state.sources.length || 4).padStart(2, '0');
  $('#lastUpdated').textContent = state.updatedAt
    ? new Intl.DateTimeFormat('th-TH', { timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(state.updatedAt)) + ' น.'
    : 'ยังไม่มีข้อมูล';
}
function renderAll() {
  leadStory(); featuredStories(); renderNews(); renderGallery(); renderHeader();
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
  const results = await Promise.allSettled([fetchJson('/api/news'), fetchJson('/api/photos')]);
  if (results[0].status === 'fulfilled' && Array.isArray(results[0].value.articles)) {
    state.articles = results[0].value.articles;
    state.updatedAt = results[0].value.updatedAt;
    state.errors = results[0].value.errors || [];
    state.sources = results[0].value.sources || [];
  }
  if (results[1].status === 'fulfilled' && Array.isArray(results[1].value.photos)) {
    state.photos = results[1].value.photos;
  }
  state.loadedOnce = true;
  state.nextRefreshAt = Date.now() + REFRESH_MS;
  state.loading = false;
  $('#headerRefresh').classList.remove('spinning');
  renderAll(); updateCountdown();
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
  $('#headerRefresh').addEventListener('click', refresh);
  $('#photoWall').addEventListener('click', e => {
    const tile = e.target.closest('[data-photo]');
    if (tile) openPhoto(Number(tile.dataset.photo));
  });
  $('#closeLightbox').addEventListener('click', closePhoto);
  $('#photoLightbox').addEventListener('click', e => { if (e.target.dataset.close) closePhoto(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePhoto(); });
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
  setInterval(() => { if (Date.now() >= state.nextRefreshAt) refresh(); }, 30_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() >= state.nextRefreshAt) refresh();
  });
  updateCountdown();
  refresh();
}
init();
