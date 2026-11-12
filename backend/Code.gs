const BOOKING_TIME_ZONE = 'Asia/Kolkata';
const BOOKING_TAB = 'Bookings';
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SLOT_DURATION = 40;
const SLOT_STARTS = [660, 700, 740, 780, 960, 1000, 1040, 1080];
const HEADERS = [
  'Booking ID', 'Request ID', 'Created (UTC)', 'Slot (IST)', 'Name', 'Email',
  'Career interest', 'Booking status', 'Email alert', 'WhatsApp alert', 'Google Meet',
  'Email attempts', 'WhatsApp attempts', 'Email lease until', 'WhatsApp lease until',
];
const COL = {
  id: 0, request: 1, created: 2, slot: 3, name: 4, email: 5, interest: 6,
  status: 7, mail: 8, whatsapp: 9, mailAttempts: 11, whatsappAttempts: 12,
  mailLease: 13, whatsappLease: 14,
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Booking')
    .setTitle('Weekend counselling · COS-Career Opportunities with Science')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Counselling')
    .addItem('Set up booking and notifications', 'setupBooking_')
    .addItem('Process pending alerts', 'processNotifications_')
    .addToUi();
}

function setupBooking_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open the private Google Sheet first.');
  let sheet = spreadsheet.getSheetByName(BOOKING_TAB);
  if (!sheet) sheet = spreadsheet.insertSheet(BOOKING_TAB);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground('#163c33').setFontColor('#ffffff').setFontWeight('bold');
    sheet.getRange('A:K').setNumberFormat('@');
  } else if (sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0].join('|') !== HEADERS.join('|')) {
    throw new Error('The Bookings tab already exists with a different layout.');
  }
  spreadsheet.setSpreadsheetTimeZone(BOOKING_TIME_ZONE);
  PropertiesService.getScriptProperties().setProperty('BOOKING_SHEET_ID', spreadsheet.getId());
  const hasTrigger = ScriptApp.getProjectTriggers()
    .some(trigger => trigger.getHandlerFunction() === 'processNotifications_');
  if (!hasTrigger) ScriptApp.newTrigger('processNotifications_').timeBased().everyMinutes(5).create();
}

function getAvailability() {
  try {
    const sheet = bookingSheet_();
    const occupied = new Set(bookingRows_(sheet)
      .filter(({ values }) => isActive_(values))
      .map(({ values }) => values[COL.slot]));
    return { ok: true, slots: slots_(Date.now()).filter(slot => !occupied.has(slot.id)) };
  } catch (error) {
    console.error('Availability failed: ' + error.name);
    return { ok: false, message: 'Availability is temporarily unavailable. Please try again later.' };
  }
}

function bookAppointment(input) {
  const booking = parseBooking_(input);
  if (!booking) return { ok: false, message: 'Check your name, email, slot and booking consent.' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { ok: false, message: 'Booking is busy. Please retry with the same details.' };
  }
  try {
    const sheet = bookingSheet_();
    const rows = bookingRows_(sheet);
    const existing = rows.find(({ values }) => values[COL.request] === booking.request);
    if (existing) {
      const row = existing.values;
      if (row[COL.slot] !== booking.slot || row[COL.email] !== booking.email || !isActive_(row)) {
        return { ok: false, message: 'Please refresh and choose a new slot.' };
      }
      return { ok: true, reference: row[COL.id], slot: row[COL.slot] };
    }
    if (!slots_(Date.now()).some(slot => slot.id === booking.slot)
        || rows.some(({ values }) => values[COL.slot] === booking.slot && isActive_(values))) {
      return { ok: false, stale: true, message: 'That slot is no longer available. Choose another time.' };
    }
    const reference = 'COS-' + Utilities.getUuid();
    sheet.appendRow([
      reference, booking.request, new Date().toISOString(), booking.slot,
      sheetText_(booking.name), booking.email, sheetText_(booking.interest),
      'BOOKED', 'PENDING', 'PENDING', '', 0, 0, 0, 0,
    ]);
    SpreadsheetApp.flush();
    return { ok: true, reference, slot: booking.slot };
  } catch (error) {
    console.error('Booking failed: ' + error.name);
    return { ok: false, message: 'Booking could not be verified. Retry with the same details.' };
  } finally {
    lock.releaseLock();
  }
}

function parseBooking_(input) {
  if (!input || input.consent !== true || input.website) return null;
  const name = cleanText_(input.name, 80);
  const email = cleanText_(input.email, 254).toLowerCase();
  const interest = cleanText_(input.interest, 80);
  const request = cleanText_(input.request, 36);
  const slot = cleanText_(input.slot, 16);
  if (!name || !/^[a-z0-9][a-z0-9.!#$%&'*+/=?^_`{|}~-]*@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request)
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slot)) return null;
  return { name, email, interest, request, slot };
}

function cleanText_(value, max) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length > max || /[\x00-\x1f\x7f]/.test(trimmed)) return '';
  return trimmed;
}

function sheetText_(value) {
  return /^[=+\-@']/.test(value) ? "'" + value : value;
}

function isActive_(row) {
  return String(row[COL.status]).trim().toUpperCase() !== 'CANCELLED';
}

function bookingSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('BOOKING_SHEET_ID');
  if (!id) throw new Error('Booking storage is unconfigured.');
  const sheet = SpreadsheetApp.openById(id).getSheetByName(BOOKING_TAB);
  if (!sheet) throw new Error('Booking storage is missing.');
  return sheet;
}

function bookingRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues()
    .map((values, index) => ({ rowNumber: index + 2, values }))
    .filter(({ values }) => Boolean(values[COL.id]));
}

function slots_(nowMs) {
  const istToday = Math.floor((nowMs + IST_OFFSET_MS) / DAY_MS) * DAY_MS;
  const slots = [];
  for (let day = 0; day < 56; day += 1) {
    const date = new Date(istToday + day * DAY_MS);
    if (![0, 6].includes(date.getUTCDay())) continue;
    const dateId = date.toISOString().slice(0, 10);
    for (const minutes of SLOT_STARTS) {
      if (date.getTime() - IST_OFFSET_MS + minutes * 60000 <= nowMs) continue;
      const start = clock_(minutes);
      slots.push({ id: dateId + 'T' + start, date: dateId, start, end: clock_(minutes + SLOT_DURATION) });
    }
  }
  return slots;
}

function clock_(minutes) {
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':'
    + String(minutes % 60).padStart(2, '0');
}

function slotDescription_(slot) {
  const [hours, minutes] = slot.slice(11).split(':').map(Number);
  return slot.replace('T', ' ') + '–' + clock_(hours * 60 + minutes + SLOT_DURATION) + ' IST';
}

function processNotifications_() {
  const properties = PropertiesService.getScriptProperties().getProperties();
  const sheet = bookingSheet_();
  for (const { rowNumber, values } of bookingRows_(sheet)) {
    if (!isActive_(values)) continue;
    for (const channel of ['mail', 'whatsapp']) {
      if (values[COL[channel]] !== 'PENDING' && values[COL[channel]] !== 'SENDING') continue;
      const attempt = claimAlert_(sheet, rowNumber, values[COL.id], channel);
      if (!attempt) continue;
      let result;
      try {
        result = channel === 'mail' ? sendMail_(properties, attempt.values) : sendWhatsApp_(properties, attempt.values);
      } catch (error) {
        console.error('Alert attempt failed for ' + channel + ': ' + error.name);
        result = 'RETRY';
      }
      finishAlert_(sheet, rowNumber, channel, attempt, result);
    }
  }
}

function claimAlert_(sheet, rowNumber, reference, channel) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return null;
  try {
    const values = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
    if (values[COL.id] !== reference || !isActive_(values)) return null;
    const state = values[COL[channel]];
    const now = Date.now();
    if (!['PENDING', 'SENDING'].includes(state) || Number(values[COL[channel + 'Lease']]) > now) return null;
    const count = Number(values[COL[channel + 'Attempts']]) || 0;
    if (count >= 6) {
      sheet.getRange(rowNumber, COL[channel] + 1).setValue('REVIEW');
      SpreadsheetApp.flush();
      return null;
    }
    const lease = now + 8 * 60 * 1000;
    sheet.getRange(rowNumber, COL[channel + 'Attempts'] + 1).setValue(count + 1);
    sheet.getRange(rowNumber, COL[channel + 'Lease'] + 1).setValue(lease);
    sheet.getRange(rowNumber, COL[channel] + 1).setValue('SENDING');
    SpreadsheetApp.flush();
    return { values, lease };
  } finally {
    lock.releaseLock();
  }
}

function finishAlert_(sheet, rowNumber, channel, attempt, result) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const row = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
    if (row[COL.id] !== attempt.values[COL.id] || Number(row[COL[channel + 'Lease']]) !== attempt.lease) return;
    sheet.getRange(rowNumber, COL[channel] + 1).setValue(result === 'RETRY' ? 'PENDING' : result);
    sheet.getRange(rowNumber, COL[channel + 'Lease'] + 1).setValue(result === 'RETRY' ? Date.now() + 4 * 60000 : 0);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function sendMail_(properties, row) {
  if (!properties.OWNER_EMAIL) return 'CONFIGURE';
  const slot = slotDescription_(row[COL.slot]);
  MailApp.sendEmail({
    to: properties.OWNER_EMAIL,
    subject: 'Counselling booked · ' + slot,
    body: 'Booking: ' + row[COL.id] + '\nSession: ' + slot
      + '\n\nOpen the private booking sheet for the student’s contact and send a Google Meet invitation.'
      + '\nhttps://docs.google.com/spreadsheets/d/' + properties.BOOKING_SHEET_ID + '/edit',
  });
  return 'ACCEPTED';
}

function sendWhatsApp_(properties, row) {
  const keys = ['WA_TOKEN', 'WA_PHONE_ID', 'WA_OWNER_NUMBER', 'WA_API_VERSION', 'WA_TEMPLATE', 'WA_LANGUAGE'];
  if (keys.some(key => !properties[key])) return 'CONFIGURE';
  if (!/^\d+$/.test(properties.WA_PHONE_ID) || !/^\d{8,15}$/.test(properties.WA_OWNER_NUMBER)
      || !/^v\d+\.\d+$/.test(properties.WA_API_VERSION)) return 'CONFIGURE';
  const url = 'https://graph.facebook.com/' + properties.WA_API_VERSION + '/' + properties.WA_PHONE_ID + '/messages';
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + properties.WA_TOKEN },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      messaging_product: 'whatsapp',
      to: properties.WA_OWNER_NUMBER,
      type: 'template',
      template: {
        name: properties.WA_TEMPLATE,
        language: { code: properties.WA_LANGUAGE },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: row[COL.id] },
            { type: 'text', text: slotDescription_(row[COL.slot]) },
          ],
        }],
      },
    }),
  });
  const code = response.getResponseCode();
  if (code >= 200 && code < 300) return 'ACCEPTED';
  if (code === 429 || code >= 500) return 'RETRY';
  return 'REVIEW';
}
