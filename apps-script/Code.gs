/**
 * CatCha Hotel — ระบบจองคิว (หลังบ้าน)
 * เฟส 2: บันทึกจอง → ลงปฏิทินร่วม "Catcha Hotel" ที่เจ้าของ 2 คนเห็นบนมือถือ
 *
 * วิธีติดตั้ง: อ่าน apps-script/SETUP.md
 * ต้องเปิด Advanced service "Google Calendar API" (Services +)
 */

var CONFIG = {
  OWNER_EMAILS: ['Chutchanok.than@gmail.com', 'pitchapawong.pw@gmail.com'],
  // อีเมลสะกดผิดเดิม — ลบสิทธิ์ทิ้งก่อนแชร์ใหม่
  STALE_OWNER_EMAILS: ['chatchanok.than@gmail.com', 'Chatchanok.than@gmail.com'],

  // ชื่อปฏิทินร่วม — ใช้ Catcha Hotel เป็นหลัก (CatCha Hotel — Bookings = ชื่อเก่าจากโค้ดก่อนหน้า)
  SHARED_CALENDAR_NAME: 'Catcha Hotel',
  SHARED_CALENDAR_ALIASES: ['Catcha Hotel', 'CatCha Hotel', 'CatCha Hotel — Bookings'],
  CALENDAR_ID_KEY: 'CATCHA_CALENDAR_ID',

  SHEET_NAME: 'Bookings',
  SHOP: 'CatCha Hotel บางนา',
  MAPS: 'https://maps.app.goo.gl/u38pzVGa9LiEsLEK8',
  TIMEZONE: 'Asia/Bangkok',

  GROOM_DURATION_MIN: 90
};

// ── หน้าเว็บ ───────────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('CatCha Hotel — จองคิว')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── รันครั้งเดียวตอนติดตั้ง ───────────────────────────────────
function setup() {
  getSheet_();
  ensureCalendarApi_();
  return 'ตั้งค่าเรียบร้อย ✅\nชีต "' + CONFIG.SHEET_NAME + '" พร้อมใช้งาน\n' + ensureSharedCalendar_();
}

// รันเมื่อ Chutchanok ยังไม่ได้อีเมล (Pitchapa ได้แล้ว) — ลบสิทธิ์เก่าแล้วส่งใหม่
function resendToChutchanok() {
  ensureCalendarApi_();
  return reshareOwnerAllCalendars_('Chutchanok.than@gmail.com');
}

// รันเมื่อเจ้าของยังไม่ได้อีเมลแชร์ปฏิทิน — ยิงอีเมลใหม่ไป 2 คน
function shareWithOwners() {
  ensureCalendarApi_();
  var lines = [];
  CONFIG.OWNER_EMAILS.forEach(function(email) {
    lines.push(reshareOwnerAllCalendars_(email));
  });
  return lines.join('\n\n') + '\n\nเช็ค Inbox + Spam + Promotions แล้วกด "เพิ่มปฏิทิน"';
}

function ensureCalendarApi_() {
  if (typeof Calendar === 'undefined' || !Calendar.Events) {
    throw new Error('เปิด Advanced service "Google Calendar API" ก่อน: Services (+) → Google Calendar API');
  }
}

function ensureSharedCalendar_() {
  var props = PropertiesService.getScriptProperties();
  var storedId = props.getProperty(CONFIG.CALENDAR_ID_KEY);

  if (storedId) {
    try {
      var stored = CalendarApp.getCalendarById(storedId);
      shareCalendarWithOwners_(stored, true);
      return calendarSetupMessage_(stored);
    } catch (e) {
      props.deleteProperty(CONFIG.CALENDAR_ID_KEY);
    }
  }

  var found = findWritableCalendar_();
  if (found) {
    props.setProperty(CONFIG.CALENDAR_ID_KEY, found.getId());
    shareCalendarWithOwners_(found, true);
    return 'ใช้ปฏิทินเดิม "' + found.getName() + '" ✅\n' + calendarSetupMessage_(found);
  }

  var cal = CalendarApp.createCalendar(CONFIG.SHARED_CALENDAR_NAME, {
    description: 'นัดจอง CatCha Hotel — ระบบสร้างอัตโนมัติ',
    timeZone: CONFIG.TIMEZONE
  });
  props.setProperty(CONFIG.CALENDAR_ID_KEY, cal.getId());
  shareCalendarWithOwners_(cal, true);

  return 'สร้างปฏิทิน "' + CONFIG.SHARED_CALENDAR_NAME + '" แล้ว ✅\n' + calendarSetupMessage_(cal);
}

function findWritableCalendar_() {
  for (var n = 0; n < CONFIG.SHARED_CALENDAR_ALIASES.length; n++) {
    var cal = findWritableCalendarByName_(CONFIG.SHARED_CALENDAR_ALIASES[n]);
    if (cal) return cal;
  }
  return null;
}

function findWritableCalendarByName_(name) {
  var token;
  do {
    var page = Calendar.CalendarList.list({ maxResults: 250, pageToken: token });
    var items = page.items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.summary !== name) continue;
      if (item.accessRole === 'owner' || item.accessRole === 'writer') {
        return CalendarApp.getCalendarById(item.id);
      }
    }
    token = page.nextPageToken;
  } while (token);
  return null;
}

function getAllWritableCatchaCalendars_() {
  var out = [];
  var seen = {};
  var token;
  do {
    var page = Calendar.CalendarList.list({ maxResults: 250, pageToken: token });
    (page.items || []).forEach(function(item) {
      if (CONFIG.SHARED_CALENDAR_ALIASES.indexOf(item.summary) < 0) return;
      if (item.accessRole !== 'owner' && item.accessRole !== 'writer') return;
      if (seen[item.id]) return;
      seen[item.id] = true;
      out.push(CalendarApp.getCalendarById(item.id));
    });
    token = page.nextPageToken;
  } while (token);
  return out;
}

function shareCalendarWithOwners_(cal, sendEmail) {
  CONFIG.OWNER_EMAILS.forEach(function(email) {
    if (sendEmail) reshareOwner_(cal.getId(), email);
    else ensureOwnerAccess_(cal.getId(), email);
  });
}

// ลบสิทธิ์เก่า (รวมอีเมลสะกดผิด) แล้วแชร์ใหม่พร้อมส่งอีเมล
function reshareOwner_(calId, email) {
  removeAclForEmail_(calId, email);
  CONFIG.STALE_OWNER_EMAILS.forEach(function(stale) { removeAclForEmail_(calId, stale); });

  var cal = CalendarApp.getCalendarById(calId);
  try { cal.addEditor(email); } catch (e) {}

  Calendar.Acl.insert({
    role: 'writer',
    scope: { type: 'user', value: email }
  }, calId, { sendNotifications: true });
}

function ensureOwnerAccess_(calId, email) {
  var aclByEmail = getAclByEmail_(calId);
  if (aclByEmail[email.toLowerCase()]) return;
  reshareOwner_(calId, email);
}

function reshareOwnerAllCalendars_(email) {
  var calendars = getAllWritableCatchaCalendars_();
  if (!calendars.length) {
    ensureSharedCalendar_();
    calendars = getAllWritableCatchaCalendars_();
  }
  var lines = [];
  calendars.forEach(function(cal) {
    try {
      reshareOwner_(cal.getId(), email);
      lines.push('✅ ' + email + ' → ' + cal.getName());
    } catch (e) {
      lines.push('❌ ' + email + ' → ' + cal.getName() + ': ' + e.message);
    }
  });
  return lines.join('\n');
}

function removeAclForEmail_(calId, email) {
  var rule = getAclByEmail_(calId)[email.toLowerCase()];
  if (!rule) return;
  try { Calendar.Acl.remove(calId, rule.id); } catch (e) {}
}

function getAclByEmail_(calId) {
  var map = {};
  var token;
  do {
    var page = Calendar.Acl.list(calId, { pageToken: token });
    (page.items || []).forEach(function(rule) {
      if (rule.scope && rule.scope.type === 'user' && rule.scope.value) {
        map[rule.scope.value.toLowerCase()] = rule;
      }
    });
    token = page.nextPageToken;
  } while (token);
  return map;
}

function calendarSetupMessage_(cal) {
  return 'ปฏิทิน: ' + cal.getName() + '\n' +
         'แชร์ไป: ' + CONFIG.OWNER_EMAILS.join(', ') + '\n' +
         ownerCalendarHint_();
}

function ownerCalendarHint_() {
  return 'มือถือ/คอม: Google Calendar → ☰ → ติ๊กเปิด "' + CONFIG.SHARED_CALENDAR_NAME + '"';
}

function getCalendarId_() {
  var storedId = PropertiesService.getScriptProperties().getProperty(CONFIG.CALENDAR_ID_KEY);
  if (storedId) {
    try {
      CalendarApp.getCalendarById(storedId);
      return storedId;
    } catch (e) {
      PropertiesService.getScriptProperties().deleteProperty(CONFIG.CALENDAR_ID_KEY);
    }
  }
  ensureSharedCalendar_();
  return PropertiesService.getScriptProperties().getProperty(CONFIG.CALENDAR_ID_KEY);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_NAME);
    sh.appendRow(['ID','สร้างเมื่อ','ลูกค้า','น้องแมว','ติดต่อ','บริการ',
                  'วันที่/เช็คอิน','เวลา/เช็คเอาท์','จำนวนคืน','เวลาเช็คอิน','สถานะ','โน้ต','EventId']);
    sh.setFrozenRows(1);
    sh.getRange('A1:M1').setFontWeight('bold');
  }
  return sh;
}

// ── บันทึกการจอง ─────────────────────────────────────────────
function saveBooking(p) {
  if (!p || !p.customer || !p.cat) throw new Error('ต้องมีชื่อลูกค้าและชื่อน้องแมว');

  ensureCalendarApi_();
  var calId = getCalendarId_();
  var cal = CalendarApp.getCalendarById(calId);

  var sh = getSheet_();
  var id = 'B' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss');
  var event, when, when2, nights = '';

  if (p.service === 'room') {
    var ci = parseDate_(p.checkin);
    var co = parseDate_(p.checkout);
    if (!ci || !co) throw new Error('ห้องพัก: ต้องมีวันเช็คอินและวันเช็คเอาท์');
    var coExclusive = new Date(co.getTime() + 86400000);
    event = insertCalendarEvent_(calId, {
      summary: '🏠 ' + p.cat + ' เข้าพัก (' + p.customer + ')',
      description: desc_(p, id),
      start: { date: formatDateYmd_(ci) },
      end: { date: formatDateYmd_(coExclusive) },
      colorId: '9'
    });
    when = p.checkin; when2 = p.checkout; nights = nights_(ci, co);
  } else {
    var d = parseDate_(p.date);
    if (!d) throw new Error('อาบน้ำ: ต้องมีวันที่นัด');
    var t = parseTime_(p.time);
    var start = new Date(d.getTime()); start.setHours(t.h, t.m, 0, 0);
    var end = new Date(start.getTime() + CONFIG.GROOM_DURATION_MIN * 60000);
    event = insertCalendarEvent_(calId, {
      summary: '🛁 อาบน้ำ ' + p.cat + ' (' + p.customer + ')',
      description: desc_(p, id),
      start: { dateTime: formatDateTimeIso_(start), timeZone: CONFIG.TIMEZONE },
      end: { dateTime: formatDateTimeIso_(end), timeZone: CONFIG.TIMEZONE },
      colorId: '5'
    });
    when = p.date; when2 = p.time;
  }

  sh.appendRow([id, new Date(), p.customer, p.cat, p.contact || '', p.service,
                when, when2, nights, '', 'รอยืนยัน', p.notes || '', event.id]);

  return { ok: true, id: id, eventId: event.id, calendar: cal.getName() };
}

function insertCalendarEvent_(calId, resource) {
  return Calendar.Events.insert(resource, calId, { sendUpdates: 'none' });
}

function getUpcomingBookings() {
  var data = getSheet_().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    out.push({ id: r[0], customer: r[2], cat: r[3], service: r[5],
               when: String(r[6]), when2: String(r[7]), nights: r[8],
               checkin: r[9], status: r[10] });
  }
  return out;
}

// ── helper ──────────────────────────────────────────────────
function desc_(p, id) {
  var L = ['ลูกค้า: ' + p.customer, 'น้องแมว: ' + p.cat, 'ติดต่อ: ' + (p.contact || '-'),
           'บริการ: ' + (p.service === 'room' ? 'ห้องพัก' : 'อาบน้ำ/กรูมมิ่ง')];
  if (p.notes) L.push('โน้ตนิสัยน้อง: ' + p.notes);
  L.push('สถานะ: รอยืนยัน', '— CatCha Booking ' + id);
  return L.join('\n');
}
function formatDateYmd_(d) {
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd');
}
function formatDateTimeIso_(d) {
  return Utilities.formatDate(d, CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}
function parseDate_(s) {
  if (!s) return null;
  var p = String(s).split('-');
  if (p.length !== 3) return null;
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
function parseTime_(s) {
  s = String(s || '');
  var m = s.match(/(\d{1,2})[.:](\d{2})/);
  if (m) return { h: +m[1], m: +m[2] };
  return { h: 10, m: 0 };
}
function nights_(a, b) { return Math.max(0, Math.round((b - a) / 86400000)); }
