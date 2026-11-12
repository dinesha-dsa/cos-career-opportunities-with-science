const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
const now = Date.parse('2026-11-14T06:15:00Z');
const baseInput = {
  name: 'Test Student', email: 'student@example.com', consent: true, website: '',
  interest: 'Engineering and technology', slot: '2026-11-14T12:20',
  request: '12345678-1111-4111-8111-123456789abc',
};

function harness() {
  const rows = [Array(15).fill('')];
  const alerts = [];
  const properties = {
    BOOKING_SHEET_ID: 'private_sheet', OWNER_EMAIL: 'owner@example.com',
    WA_TOKEN: 'test-token', WA_PHONE_ID: '1234', WA_OWNER_NUMBER: '919000000000',
    WA_API_VERSION: 'v25.0', WA_TEMPLATE: 'new_booking', WA_LANGUAGE: 'en',
  };
  const sheet = {
    getLastRow: () => rows.length,
    getRange(start, column, count, width) {
      return {
        getValues: () => rows.slice(start - 1, start - 1 + count)
          .map(row => row.slice(column - 1, column - 1 + width)),
        setValue: value => { rows[start - 1][column - 1] = value; },
      };
    },
    appendRow: row => rows.push(Array.from(row)),
  };
  let locked = false;
  const context = vm.createContext({
    Date: class extends Date {
      static now() { return now; }
      constructor(...args) { super(...(args.length ? args : [now])); }
    },
    console,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties[key],
      getProperties: () => properties,
    }) },
    LockService: { getScriptLock: () => ({
      tryLock: () => {
        if (locked) return false;
        locked = true;
        return true;
      },
      releaseLock: () => { locked = false; },
    }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush() {} },
    Utilities: { getUuid: () => 'fake-uuid-' + rows.length },
    MailApp: { sendEmail: payload => alerts.push({ mail: payload }) },
    UrlFetchApp: { fetch: (url, options) => {
      alerts.push({ url, body: JSON.parse(options.payload) });
      return { getResponseCode: () => 200 };
    } },
  });
  vm.runInContext(source, context);
  return { context, rows, alerts };
}

test('only future weekends are offered with four 40-minute starts per window', () => {
  const { context } = harness();
  const { slots } = context.getAvailability();
  const saturday = slots.filter(slot => slot.date === '2026-11-14');
  assert.equal(saturday[0].start, '12:20');
  const sunday = slots.filter(slot => slot.date === '2026-11-15');
  assert.deepEqual(Array.from(sunday, slot => slot.start), [
    '11:00', '11:40', '12:20', '13:00', '16:00', '16:40', '17:20', '18:00',
  ]);
  assert.equal(sunday[3].end, '13:40');
  assert.equal(sunday[7].end, '18:40');
  assert.ok(slots.every(slot => [0, 6].includes(new Date(slot.date + 'T00:00:00Z').getUTCDay())));
});

test('requests are idempotent and a slot is reserved once until cancelled', () => {
  const { context, rows } = harness();
  const first = context.bookAppointment(baseInput);
  assert.equal(first.ok, true);
  assert.equal(context.bookAppointment(baseInput).reference, first.reference);
  const second = { ...baseInput, email: 'other@example.com',
    request: '12345678-1111-4111-8111-123456789abd' };
  assert.equal(context.bookAppointment(second).stale, true);
  assert.equal(rows.length, 2);
  assert.ok(!context.getAvailability().slots.some(slot => slot.id === baseInput.slot));
  rows[1][7] = 'CANCELLED';
  assert.equal(context.bookAppointment(second).ok, true);
  assert.equal(rows.length, 3);
});

test('invalid input and unsafe spreadsheet prefixes are handled', () => {
  const { context, rows } = harness();
  assert.equal(context.bookAppointment({ ...baseInput, consent: false }).ok, false);
  assert.equal(context.bookAppointment({ ...baseInput, email: 'bad' }).ok, false);
  assert.equal(context.bookAppointment({ ...baseInput, slot: '2026-11-16T12:20' }).stale, true);
  assert.equal(context.bookAppointment({ ...baseInput, name: '=1+1' }).ok, true);
  assert.equal(rows[1][4], "'=1+1");
});

test('one alert per configured channel after a successful reservation, without student contact data', () => {
  const { context, rows, alerts } = harness();
  assert.equal(context.bookAppointment(baseInput).ok, true);
  context.processNotifications_();
  context.processNotifications_();
  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].mail.to, 'owner@example.com');
  assert.equal(alerts[1].body.template.components[0].parameters[1].text, '2026-11-14 12:20–13:00 IST');
  assert.ok(!JSON.stringify(alerts).includes('student@example.com'));
  assert.equal(rows[1][8], 'ACCEPTED');
  assert.equal(rows[1][9], 'ACCEPTED');
});

test('booking page script parses and exposes the booking flow', () => {
  const html = fs.readFileSync(path.join(__dirname, 'Booking.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script));
  assert.match(script, /\.bookAppointment\(/);
});
