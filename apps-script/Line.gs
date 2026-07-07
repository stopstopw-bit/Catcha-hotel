/**
 * CatCha Hotel — LINE Messaging API (เฟส 3)
 * Flex Message + push หาลูกค้า · แจ้งเจ้าของเมื่อยืนยัน
 *
 * ตั้งค่า: รัน setLineConfig('CHANNEL_ACCESS_TOKEN', 'LIFF_ID') ครั้งเดียว
 * หรือใส่ใน Script Properties: LINE_CHANNEL_TOKEN, LINE_LIFF_ID
 */

function setLineConfig(channelToken, liffId) {
  if (!channelToken) throw new Error('ต้องมี Channel access token');
  var props = { LINE_CHANNEL_TOKEN: channelToken };
  if (liffId) props.LINE_LIFF_ID = liffId;
  PropertiesService.getScriptProperties().setProperties(props);
  return 'บันทึก LINE config แล้ว ✅' + (liffId ? ' (LIFF: ' + liffId + ')' : '');
}

function getLineToken_() {
  return PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_TOKEN') || '';
}

function getLineLiffId_() {
  return PropertiesService.getScriptProperties().getProperty('LINE_LIFF_ID') || '';
}

function getWebAppUrl_() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (e) {
    return '';
  }
}

function lineConfirmUrl_(bookingId) {
  var liffId = getLineLiffId_();
  if (liffId) {
    return 'https://liff.line.me/' + liffId + '?id=' + encodeURIComponent(bookingId);
  }
  var base = getWebAppUrl_();
  return base ? base + '?page=confirm&id=' + encodeURIComponent(bookingId) : '';
}

// ── ส่งการ์ดเตือน (เจ้าของกดจากหน้าเว็บ หรือ cron เที่ยง) ────────
function sendReminderCard(bookingId) {
  var row = findBookingRow_(bookingId);
  if (!row) throw new Error('ไม่พบการจอง ' + bookingId);
  var b = rowToBooking_(row);

  var lineUserId = resolveLineUserId_(b);
  if (!lineUserId) {
    throw new Error('ไม่มี LINE User ID — ใส่ในช่องติดต่อ (ขึ้นต้น U...) หรือคอลัมน์ LineUserId');
  }

  linePush_(lineUserId, buildReminderFlex_(b));
  markReminderSent_(row.sheetRow);
  return { ok: true, id: bookingId, sentTo: lineUserId };
}

function sendDailyReminders() {
  var list = getBookingsForReminder_();
  var sent = 0;
  var skipped = [];
  list.forEach(function(b) {
    try {
      if (!resolveLineUserId_(b)) {
        skipped.push(b.id + ' (ไม่มี LINE ID)');
        return;
      }
      sendReminderCard(b.id);
      sent++;
    } catch (e) {
      skipped.push(b.id + ': ' + e.message);
    }
  });
  return 'ส่งการ์ดเตือน ' + sent + ' รายการ' +
         (skipped.length ? '\nข้าม/ผิดพลาด:\n' + skipped.join('\n') : '');
}

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sendDailyReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendDailyReminders')
    .timeBased()
    .atHour(12)
    .everyDays(1)
    .inTimezone(CONFIG.TIMEZONE)
    .create();
  return 'ตั้งเวลาส่งเตือนอัตโนมัติ ทุกวัน 12:00 น. (เวลาไทย) เรียบร้อย ✅';
}

function notifyOwnersConfirmed_(booking) {
  var token = getLineToken_();
  if (!token) return;
  var msg = '✅ ลูกค้ายืนยันแล้ว\n' +
            booking.customer + ' · ' + booking.cat + '\n' +
            formatBookingWhen_(booking) +
            (booking.checkin ? '\nเช็คอิน: ' + booking.checkin : '');
  CONFIG.OWNER_EMAILS.forEach(function(email) {
    // เจ้าของแจ้งผ่านอีเมล/ปฏิทิน — LINE push เฉพาะถ้ามี OWNER_LINE_IDS ในอนาคต
  });
  var ownerLineIds = (PropertiesService.getScriptProperties().getProperty('OWNER_LINE_IDS') || '')
    .split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  ownerLineIds.forEach(function(uid) {
    try { linePushText_(uid, msg); } catch (e) {}
  });
}

// ── LINE API ──────────────────────────────────────────────────
function linePush_(to, messages) {
  var token = getLineToken_();
  if (!token) throw new Error('ยังไม่ได้ตั้ง LINE — รัน setLineConfig(token, liffId) ก่อน');

  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ to: to, messages: [messages] }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('LINE API: ' + res.getContentText());
  }
}

function linePushText_(to, text) {
  linePush_(to, { type: 'text', text: text });
}

// ── Flex Message builders (ข้อความตาม SCOPE §8) ─────────────
function buildReminderFlex_(b) {
  var confirmUrl = lineConfirmUrl_(b.id);
  var isRoom = b.service === 'room';
  var hero = isRoom ? 'พรุ่งนี้ถึงวันเช็คอินแล้วค่ะ' : 'พรุ่งนี้ถึงคิวอาบน้ำแล้วค่ะ';
  var sub = isRoom ? 'ห้องพักแมว CatCha' : 'อาบน้ำ / กรูมมิ่ง';
  var bodyText = isRoom
    ? 'พรุ่งนี้' + b.cat + 'จะมาเข้าพักกับเราแล้วค่ะ 🥰\nเลือกเวลาที่สะดวกมาส่งน้อง แล้วกดยืนยันให้เรานิดนึงนะคะ\nเราจะเตรียมห้องและของใช้ของน้องไว้รอต้อนรับให้พร้อมค่ะ 🧡'
    : 'ถึงคิวอาบน้ำของ' + b.cat + 'แล้วค่ะ 🥰\nรบกวนกดยืนยันนัดหมายให้เรานิดนึงนะคะ\nเดี๋ยวเราดูแลน้องให้สะอาด ขนนุ่ม ฟู หอม พร้อมกลับบ้านเหมือนเดิมเลยค่ะ 🧡';

  var rows = [
    flexRow_('น้องแมว', b.cat),
    flexRow_('ของคุณ', b.customer),
    flexRow_(isRoom ? 'เช็คอิน' : 'วัน-เวลา', formatBookingWhen_(b))
  ];
  if (isRoom && b.when2) rows.push(flexRow_('เช็คเอาท์', formatDateThai_(b.when2)));

  var contents = [
    { type: 'box', layout: 'vertical', backgroundColor: '#FFF8F0', paddingAll: '16px', contents: [
      { type: 'text', text: hero, weight: 'bold', size: 'md', color: '#5C4033' },
      { type: 'text', text: sub, size: 'xs', color: '#A08060', margin: 'sm' }
    ]},
    { type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'sm', contents: rows },
    { type: 'text', text: bodyText, size: 'sm', color: '#5C4033', wrap: true, margin: 'lg' }
  ];

  var footerButtons = [];
  if (confirmUrl) {
    footerButtons.push({
      type: 'button', style: 'primary', height: 'sm', color: '#C4956A',
      action: { type: 'uri', label: isRoom ? '🐾 ยืนยัน + แจ้งเวลาเช็คอิน' : '🐾 ยืนยันคิวเลยน้า', uri: confirmUrl }
    });
  }
  footerButtons.push({
    type: 'button', style: 'link', height: 'sm',
    action: { type: 'uri', label: '🗺️ ดูเส้นทางมาร้าน', uri: CONFIG.MAPS }
  });

  return {
    type: 'flex',
    altText: hero + ' — ' + b.cat,
    contents: {
      type: 'bubble', size: 'mega',
      body: { type: 'box', layout: 'vertical', contents: contents },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerButtons }
    }
  };
}

function flexRow_(label, value) {
  return {
    type: 'box', layout: 'horizontal', contents: [
      { type: 'text', text: label, size: 'xs', color: '#A08060', flex: 2 },
      { type: 'text', text: String(value), size: 'sm', color: '#3D2B1F', flex: 5, wrap: true }
    ]
  };
}

function resolveLineUserId_(b) {
  if (b.lineUserId && /^U[a-f0-9]{32}$/i.test(b.lineUserId)) return b.lineUserId;
  var c = String(b.contact || '').trim();
  if (/^U[a-f0-9]{32}$/i.test(c)) return c;
  return '';
}

function getBookingsForReminder_() {
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var ymd = Utilities.formatDate(tomorrow, CONFIG.TIMEZONE, 'yyyy-MM-dd');

  var out = [];
  var data = getSheet_().getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var b = rowToBooking_({ row: data[i], sheetRow: i + 1 });
    if (b.status !== 'รอยืนยัน') continue;
    if (bookingDateYmd_(b) !== ymd) continue;
    out.push(b);
  }
  return out;
}

function bookingDateYmd_(b) {
  var d = String(b.when || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.substring(0, 10);
  return '';
}

function formatBookingWhen_(b) {
  if (b.service === 'room') {
    var s = formatDateThai_(b.when);
    if (b.when2) s += ' → ' + formatDateThai_(b.when2);
    if (b.nights) s += ' (' + b.nights + ' คืน)';
    return s;
  }
  return formatDateThai_(b.when) + (b.when2 ? ' · ' + b.when2 + ' น.' : '');
}

function formatDateThai_(ymd) {
  if (!ymd) return '—';
  var s = String(ymd);
  if (s.indexOf('-') < 0) return s;
  var p = s.split('-');
  if (p.length < 3) return s;
  var months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return parseInt(p[2], 10) + ' ' + months[parseInt(p[1], 10) - 1] + ' ' + (parseInt(p[0], 10) + 543);
}

function markReminderSent_(sheetRow) {
  getSheet_().getRange(sheetRow, COL.SENT_AT + 1).setValue(new Date());
}
