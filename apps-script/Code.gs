/**
 * CatCha Hotel — ระบบจองคิว (หลังบ้าน)
 * เฟส 2: บันทึกจอง → สร้างนัดใน Google Calendar + เชิญเจ้าของ 2 คน
 *
 * วิธีติดตั้ง: อ่าน apps-script/SETUP.md
 */

var CONFIG = {
  // อีเมลเจ้าของ 2 คน — จะถูกเชิญเข้านัดในปฏิทินทุกครั้ง
  OWNER_EMAILS: ['Stopstop.w@gmail.com', 'Chatchanok.than@gmail.com'],

  // ปฏิทินที่จะลงนัด: 'primary' = ปฏิทินหลักของบัญชีที่รันสคริปต์นี้ (ควรเป็น Stopstop.w)
  CALENDAR_ID: 'primary',

  SHEET_NAME: 'Bookings',
  SHOP: 'CatCha Hotel บางนา',
  MAPS: 'https://maps.app.goo.gl/u38pzVGa9LiEsLEK8',

  GROOM_DURATION_MIN: 90       // อาบน้ำ/กรูมมิ่ง กันเวลาไว้กี่นาทีในปฏิทิน
};

// ── หน้าเว็บ (เปิดจากลิงก์ Web App) ─────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('CatCha Hotel — จองคิว')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── รันครั้งเดียวตอนติดตั้ง (สร้างชีต + ขออนุญาต Calendar) ────────
function setup() {
  var sh = getSheet_();
  getCal_(); // trigger สิทธิ์ปฏิทิน
  return 'ตั้งค่าเรียบร้อย ✅  ชีต "' + CONFIG.SHEET_NAME + '" พร้อมใช้งาน';
}

// คืนปฏิทินที่จะลงนัด — 'primary'/ว่าง = ปฏิทินหลักของบัญชี (getDefaultCalendar ชัวร์กว่า getCalendarById('primary'))
function getCal_() {
  var id = CONFIG.CALENDAR_ID;
  if (!id || id === 'primary') return CalendarApp.getDefaultCalendar();
  return CalendarApp.getCalendarById(id) || CalendarApp.getDefaultCalendar();
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

// ── บันทึกการจอง (ฟอร์มเรียกผ่าน google.script.run.saveBooking) ──
function saveBooking(p) {
  if (!p || !p.customer || !p.cat) throw new Error('ต้องมีชื่อลูกค้าและชื่อน้องแมว');

  var sh  = getSheet_();
  var cal = getCal_();
  var id  = 'B' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmmss');
  var guests = CONFIG.OWNER_EMAILS.join(',');
  var event, when, when2, nights = '';

  if (p.service === 'room') {
    var ci = parseDate_(p.checkin);
    var co = parseDate_(p.checkout);
    if (!ci || !co) throw new Error('ห้องพัก: ต้องมีวันเช็คอินและวันเช็คเอาท์');
    var coExclusive = new Date(co.getTime() + 86400000);   // all-day event วันจบเป็น exclusive
    event = cal.createAllDayEvent('🏠 ' + p.cat + ' เข้าพัก (' + p.customer + ')',
              ci, coExclusive, { guests: guests, sendInvites: true, description: desc_(p, id) });
    setColor_(event, CalendarApp.EventColor.PALE_BLUE);
    when = p.checkin; when2 = p.checkout; nights = nights_(ci, co);
  } else {
    var d = parseDate_(p.date);
    if (!d) throw new Error('อาบน้ำ: ต้องมีวันที่นัด');
    var t = parseTime_(p.time);
    var start = new Date(d.getTime()); start.setHours(t.h, t.m, 0, 0);
    var end   = new Date(start.getTime() + CONFIG.GROOM_DURATION_MIN * 60000);
    event = cal.createEvent('🛁 อาบน้ำ ' + p.cat + ' (' + p.customer + ')',
              start, end, { guests: guests, sendInvites: true, description: desc_(p, id) });
    setColor_(event, CalendarApp.EventColor.YELLOW);
    when = p.date; when2 = p.time;
  }

  sh.appendRow([id, new Date(), p.customer, p.cat, p.contact || '', p.service,
                when, when2, nights, '', 'รอยืนยัน', p.notes || '', event.getId()]);

  return { ok: true, id: id, eventId: event.getId() };
}

// ── อ่านนัดที่จะถึง (ไว้ให้หน้าเว็บโหลดตารางในเฟสถัดไป) ──────────
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
function parseDate_(s) {
  if (!s) return null;
  var p = String(s).split('-');
  if (p.length !== 3) return null;
  return new Date(+p[0], +p[1] - 1, +p[2]);   // เที่ยงคืนเวลาเครื่อง
}
function parseTime_(s) {
  s = String(s || '');
  var m = s.match(/(\d{1,2})[.:](\d{2})/);
  if (m) return { h: +m[1], m: +m[2] };
  return { h: 10, m: 0 };                      // เผื่อ "ระบุเอง" → ตั้ง 10:00
}
function nights_(a, b) { return Math.max(0, Math.round((b - a) / 86400000)); }
function setColor_(ev, c) { try { ev.setColor(c); } catch (e) {} }
