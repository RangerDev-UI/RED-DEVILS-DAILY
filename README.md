# RED DEVILS DAILY — เว็บข่าวแมนยู (พร้อม Netlify)

เว็บไซต์แฟนบอลแมนเชสเตอร์ ยูไนเต็ด ธีมแดง-ดำ **เน้นข่าวพร้อมภาพ** ทำงานแบบเว็บจริง ไม่ใช่ภาพตัวอย่างหรือหน้าจอที่ต้องกรอกข้อมูลเอง

## คุณสมบัติ

**Enhanced Edition (19 Nov 2026):** มีรายการข่าวที่บันทึกไว้ในเบราว์เซอร์ (localStorage), เลื่อนข่าวเด่น 4 ข่าว, ป้ายข่าวใหม่ภายใน 24 ชั่วโมง, ดูภาพเพิ่มได้ตามจำนวนที่ API ส่งมา, เปลี่ยนรูปใน Lightbox ด้วยปุ่มหรือคีย์บอร์ด และข้อความแจ้งเมื่อฟีดหรือคลังภาพขัดข้อง (ไม่มีการรับประกันข่าวหรือภาพใหม่ทุกวัน)


- รวมลิงก์ข่าวล่าสุดจากฟีดของ Manchester United, The Guardian, Google News (อังกฤษและไทย)
- ภาพประกอบเกี่ยวกับแมนเชสเตอร์ ยูไนเต็ดจาก **Wikimedia Commons** (เลือกเฉพาะ CC / public domain เท่าที่ metadata ระบุ) พร้อมชื่อผู้สร้างและลิงก์เงื่อนไขสิทธิ์
- ข่าวเด่น, ข่าวล่าสุด, กรองหมวด, ค้นหา และ photo wall ที่กดดูภาพเต็มได้
- **อัปเดตอัตโนมัติทุก 10 นาที** เมื่อมีผู้เปิดเว็บไว้ และอัปเดตทันทีเมื่อผู้ใช้เข้าหน้าหลังเว็บไม่ได้เปิดอยู่
- Netlify Functions ฝั่งเซิร์ฟเวอร์ มีแคชข่าว 10 นาที และแคชรูป 15 นาที ช่วยลดการเรียก API
- ไม่ต้องใช้ API key, ไม่ต้องเชื่อมฐานข้อมูล, ไม่ต้องเปิดเซิร์ฟเวอร์ส่วนตัว
- รองรับคอมพิวเตอร์และมือถือ

> สำคัญ: รูปที่ใช้เป็น **ภาพประกอบ** ไม่จำเป็นต้องเป็นรูปจากเหตุการณ์ในข่าวที่ปรากฏข้างกัน และภาพใหม่ในคลัง Commons อาจมีน้อยกว่าจำนวนข่าวใหม่ ตัวเว็บตรวจหาภาพใหม่โดยอัตโนมัติ แต่ไม่สามารถการันตีว่า Commons จะมีภาพแมนยูล่าสุดทุกวัน

## วิธีนำขึ้น GitHub + Netlify

1. แตกไฟล์ `red-devils-daily.zip` คุณจะเห็น `public/`, `lib/`, `netlify/`, `tests/`, `netlify.toml`, `package.json` ฯลฯ
2. ใน GitHub กด **New repository** ตั้งชื่อ `red-devils-daily` (สร้างเป็นโปรเจกต์ใหม่ อย่าใช้ repo ของ StockScope)
3. อัปโหลด **ไฟล์และโฟลเดอร์ภายใน** โปรเจกต์ลง repo นี้ โดยโครงสร้างต้องอยู่ที่ราก repo (ไม่ควรมีโฟลเดอร์ `red-devils-daily` ซ้อนชั้น)
4. ใน [Netlify](https://app.netlify.com/) เลือก **Add new project → Import an existing project → GitHub** และเลือก repo ที่เพิ่งสร้าง
5. Netlify ควรอ่านค่าจาก `netlify.toml` อัตโนมัติ:
   - Build command: **ปล่อยว่าง**
   - Publish directory: **`public`**
   - Functions directory: **`netlify/functions`**
6. กด **Deploy** แล้วเปิด URL ที่ Netlify ให้มาได้เลย หน้าเว็บจะเรียก `/api/news` และ `/api/photos` โดยอัตโนมัติ

**อย่าใช้ Netlify Drop แบบลากเฉพาะโฟลเดอร์ `public/`** เพราะ Netlify Functions จะไม่ถูกนำขึ้นด้วยและข่าวสดจะไม่ทำงาน ใช้วิธีเชื่อม repo GitHub ตามด้านบน

เมื่อแก้โค้ดและ push เข้า GitHub, Netlify จะ deploy เวอร์ชันใหม่ตามปกติ โดยไม่ต้องแก้ค่า API keys

## ตรวจสอบระบบ

หลัง deploy ลองเปิด:

- `https://ชื่อเว็บของคุณ.netlify.app/api/news` — ต้องเห็น JSON ที่มี `articles`, `updatedAt`, `sources`
- `https://ชื่อเว็บของคุณ.netlify.app/api/photos` — ต้องเห็น JSON ที่มี `photos` และเครดิตภาพ

ข่าวในบางฟีดอาจใช้ไม่ได้ชั่วคราว, ถูกจำกัดการเข้าถึง หรือเปลี่ยน URL ได้ หน้าเว็บจะแสดงข่าวจากฟีดอื่นเท่าที่ยังเข้าถึงได้โดยไม่แต่งข่าวขึ้นเอง

## เปิดภาพข่าวต้นฉบับ (ทางเลือก)

ค่าเริ่มต้นเว็บจะแสดงเฉพาะ **ภาพเสรีจาก Wikimedia Commons** คู่กับข่าว จึงไม่ต้องดึง/เก็บภาพจากเว็บข่าวอื่น

หากคุณได้รับอนุญาตให้ใช้ภาพจากผู้เผยแพร่ข่าวจริง ๆ ให้เพิ่ม environment variable ใน Netlify:

`ALLOW_PUBLISHER_THUMBNAILS=true`

และ deploy อีกครั้ง จะใช้ image ที่ feed ระบุเป็นลำดับแรกสำหรับข่าวที่มีภาพ โดยต้องตรวจสอบเงื่อนไขของเจ้าของลิขสิทธิ์แต่ละแหล่งและการ hotlinking ก่อนเปิดใช้ โดยเฉพาะหากหารายได้จากเว็บ การแสดงที่มาเพียงอย่างเดียว **ไม่ใช่สิทธิ์ในการนำภาพมาใช้**

## โครงสร้าง

```text
public/
  index.html             หน้าเว็บ
  assets/site.css        ดีไซน์แดง-ดำ / รองรับมือถือ
  assets/site.js         UI, ค้นหา, รีเฟรชทุก 10 นาที, photo lightbox
netlify/functions/
  news.mjs               รวม RSS, จัดหมวด, แคช
  photos.mjs             ภาพ Commons, ตรวจสิทธิ์, แคช
lib/
  feeds.mjs              RSS parser และแหล่งข่าว
  commons.mjs            เรียก Wikimedia Commons API
netlify.toml             ตั้งค่า deploy และ /api redirects
```

## ทดสอบบนเครื่อง

ต้องมี Node.js 18 ขึ้นไป

```sh
npm test
npm run serve
```

`npm run serve` ใช้ Netlify CLI ผ่าน `npx` และอาจต้องติดตั้ง/ล็อกอิน CLI ตามหน้าจอ เรียกเว็บผ่าน address ที่ Netlify CLI แสดง (ไม่ใช่การเปิด `index.html` โดยตรง เพราะ API ต้องทำงานด้วย)

## ลิขสิทธิ์และความชัดเจน

- เว็บนี้เป็นเว็บแฟนบอลอิสระ ไม่ได้เป็นเว็บไซต์ทางการหรือได้รับการรับรองโดย Manchester United
- ทุกข่าวลิงก์กลับไปหาเจ้าของเนื้อหา ไม่คัดลอกเนื้อหาข่าวเต็ม
- รูปที่เลือกจาก Wikimedia Commons อ้างอิงใบอนุญาตของแต่ละไฟล์ พร้อมชื่อผู้สร้าง และกดดูเครดิต/ใบอนุญาตในแกลเลอรีได้
- เครดิตของภาพเริ่มต้น: [Old Trafford outside 20060726 1.jpg](https://commons.wikimedia.org/wiki/File:Old_Trafford_outside_20060726_1.jpg), André Zahn, [CC BY-SA 2.0 DE](https://creativecommons.org/licenses/by-sa/2.0/de/deed.en); ในหน้าเว็บรูปนี้ใช้แบบครอปให้พอดีกับกรอบภาพ
- ข่าวและรูปใหม่ขึ้นกับการเผยแพร่และความพร้อมของระบบผู้ให้บริการภายนอก; การรีเฟรชไม่เท่ากับการรับประกันข่าว/รูปใหม่

## Matchday / โปรแกรมแมนยู (เพิ่มในเวอร์ชันนี้)

- แสดงนัดต่อไป, โปรแกรมถัดไปสูงสุด 6 นัด, ผลย้อนหลังสูงสุด 5 นัด, และเกมที่กำลังแข่ง (ตามข้อมูลที่ได้รับ) โดยแสดงเวลาคิกออฟตาม **Asia/Bangkok**
- ดึงข้อมูลผ่าน Netlify Function `/api/matches` จาก endpoint ทีมแมนยูของ ESPN ในพรีเมียร์ลีก, เอฟเอคัพ, ลีกคัพ, แชมเปียนส์ลีก และยูโรปาลีก (เฉพาะรายการที่แหล่งข้อมูลมีจริง)
- ไม่มีการแต่งผลการแข่งขันขึ้นมาเอง; หากผู้ให้บริการไม่ตอบกลับ เว็บจะแสดงข้อความเตือนและลิงก์ไปยังโปรแกรมต้นฉบับ
- มีลิงก์ข่าว **ก่อนเกม / หลังเกม** จากพาดหัว RSS ที่ตรงหมวดจริง (ไม่สร้างบทความและไม่รับประกันว่ามีครบทุกนัด)
- เพิ่มปุ่มกรองแกลเลอรี **ภาพนักเตะ** โดยใช้ภาพ Creative Commons ที่ค้นได้จาก Wikimedia Commons; **ภาพในอดีต/อดีตนักเตะอาจปรากฏได้** ไม่ใช่การยืนยันรายชื่อทีมปัจจุบัน
- **ESPN endpoint ที่ใช้เป็น API สาธารณะที่ไม่ได้รับรองเป็นทางการสำหรับบุคคลภายนอก** จึงอาจเปลี่ยนรูปแบบ/จำกัดการเข้าถึงได้ ควรตรวจสอบการให้สิทธิ์และข้อกำหนดของผู้ให้บริการก่อนเปิดเว็บเชิงพาณิชย์
- เก็บข้อมูลโปรแกรมในหน่วยความจำของ Function 10 นาที (ลดเหลือ 1 นาทีเมื่อมีเกมสด); หน้าเว็บตรวจสอบทุก 10 นาทีขณะเปิดอยู่ **จึงไม่ใช่ระบบไลฟ์สกอร์แบบเรียลไทม์**
- ไม่จำเป็นต้องเพิ่ม API key ใน Netlify

ทดสอบระบบหลัง Deploy ด้วย `https://<your-site>.netlify.app/api/matches` จะได้ `live`, `upcoming`, `results`, `partial`, `errors`, `updatedAt` และ `sourceUrl` โดยสกอร์/เวลาเปลี่ยนตามข้อมูลจริงจากแหล่งที่มา

## โลโก้สโมสร (Club crests)

- โลโก้แมนเชสเตอร์ ยูไนเต็ดแสดงที่หัวเว็บ; ส่วน MATCHDAY, รายการโปรแกรม และผลการแข่งขันแสดงโลโก้ทีมเหย้า/เยือนตามแมตช์จริง
- API ฝั่งเซิร์ฟเวอร์เลือก URL รูปจาก ESPN เฉพาะโดเมน `a.espncdn.com` หรือใช้ URL ตามรหัสทีมตัวเลขที่ ESPN ให้มาเท่านั้น; หน้าเว็บตรวจสอบ URL ซ้ำอีกครั้ง
- ถ้าไม่มีรหัสทีม/ภาพโหลดผิดพลาด จะแสดงตัวย่อชื่อทีมแทน โดยไม่สร้างโลโก้ปลอม
- รูปตราสโมสรเป็นเครื่องหมายการค้าของสโมสรนั้น ๆ ใช้เพื่อระบุทีมในเว็บไซต์แฟนบอลอิสระ ไม่ได้เป็นการได้รับการรับรองจากสโมสร
- ไฟล์ภาพโหลดจาก ESPN CDN โดยตรง จึงต้องทดสอบว่าผู้ให้บริการอนุญาตสำหรับรูปแบบการใช้งานจริงก่อนเผยแพร่ โดยเฉพาะเพื่อการค้า


## Live scores, Premier League table, and source health (19 Nov 2026)

- `/api/standings` gets current **Premier League** standings from ESPN. It validates the season and keeps missing stats as “—”, never zero. Cached for 30 minutes on the server. The table highlights Manchester United.
- When a game is explicitly live, the **open browser** refreshes `/api/matches` every **45 seconds**. Around kickoff it polls every **90 seconds**; otherwise every 10 minutes. Actual freshness depends on upstream ESPN and CDN caching. This is **not instant/official real-time**.
- The homepage shows distinct freshness badges for news, photos, fixtures and standings, including each server check time in Asia/Bangkok. When sources are missing/old/partial, users see a warning instead of invented figures.
- `/api/health` performs an on-demand independent check of four services, returning `status`, `checkedAt`, `services`, `latestPublishedAt`. It may return HTTP 503 if any service is unavailable or stale.
- Netlify Scheduled Function `monitor.mjs` runs **every 30 minutes** on **published production deploys**, including with no visitors. It checks the four sources and writes summaries/warnings to **Netlify function logs only**. It does not maintain a history, send push notifications, email users or guarantee upstream updates. Inspect logs in Netlify Functions > monitor.
- ESPN is an unofficial, undocumented third-party feed; source changes/blocks may cause missing data. This release is locally tested with deterministic fixtures; live Netlify operation must be checked after deploy.
- After production deploy, check `/api/news`, `/api/photos`, `/api/matches`, `/api/standings`, and `/api/health`; monitor in Netlify Functions.


## NEW: SQUAD & TRANSFER DESK (Nov 2026)

- `#squad`: automatically loads Manchester United first-team roster from the ESPN team roster endpoint via `/api/squad`. Group filters, player name search, position, jersey number, source profile link, and permitted ESPN player headshots with text fallback. Individual appearances/goals/assists only display **when the upstream roster includes explicit season figures**; missing data is `—`, not zero. If ESPN blocks or changes the endpoint, the website shows a warning, not a fictional squad.
- `#transfers`: separate `/api/transfers` endpoint queries the club RSS feed and targeted transfer-news Google News feeds. Categorizes **club announcements** only when the source ID is the club RSS feed, the article's `https://www.manutd.com` URL is authenticated by hostname, and its title explicitly refers to a completed transfer/contract announcement without uncertainty wording. All other reports, even if they say "confirmed", appear as **reports/rumours** pending an original club announcement. This is a rules-based label, not editorial fact-checking; the club feed may include academy or women's team stories.
- Existing homepage news feed, gallery, matchday, standings, and live refresh features are preserved.
- Auto-update: squad every 3 hours on active browser tab and server memory cache ~3 hours; transfer RSS every 10 minutes. First page load includes both. Scheduled monitor checks both every 30 minutes after production deploy and records results to Netlify Logs; this does not guarantee upstream content updates or push notifications.
- Endpoints for post-deploy testing: `/api/squad` (`players`, `hasData`, `updatedAt`), `/api/transfers` (`articles`, `clubCount`, `reportedCount`, `partial`), `/api/health` (now six service statuses).
- ESPN's soccer endpoint and player headshots are undocumented third-party services. Verify license / hotlink use and accuracy before commercial use; photo rights remain with rights owners. No API key is needed for this prototype.


## ตรวจข้อมูล MATCHDAY (แก้แหล่งโปรแกรมสำรอง 19 พ.ย. 2026)
- หาก ESPN endpoint รายการแข่งขันเดิมส่งเฉพาะผลย้อนหลัง เว็บจะตรวจ endpoint โปรแกรมทุกถ้วยอีกแหล่งจาก ESPN ควบคู่กัน
- ยอมรับรหัสแมนยูเมื่อ ESPN ส่ง team ID ใน competitor.id แทน competitor.team.id แต่ยังต้องตรงกับรหัสทีม 360
- `/api/matches` มี `diagnostics` (จำนวน event จากลีก, จำนวนที่รับมา, สถานะ fallback, จำนวนเกมล่วงหน้า) เพื่อช่วยวิเคราะห์เมื่อไม่พบเกม
- หากไม่มีเกมล่วงหน้าหรือ ESPN ไม่ตอบกลับ เว็บไม่สร้างวันแข่ง/สกอร์ขึ้นเอง
- เมื่อไม่มีข้อมูลเกมถัดไป API cache เหลือ 1 นาทีเพื่อให้ลองดึงใหม่ได้เร็วขึ้น
