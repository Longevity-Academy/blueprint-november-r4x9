/* Offline regression: all requests are mocked. No CRM orders or payments. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../nov/vip-enroll.js'), 'utf8');
function storage(map = new Map()) {
  return { getItem: key => map.has(key) ? map.get(key) : null, setItem: (key, value) => map.set(key, String(value)) };
}
function setup(options = {}) {
  const calls = [], reports = [], local = options.local || storage(), session = storage();
  const paidResult = Promise.resolve({ ok: true, status: 202 });
  const window = {
    LLA_ECOMM_CONFIG: { mode: 'ecomm', env: options.env || 'production', workerBase: 'https://mock.invalid' },
    LLA_PROMO: { active: options.active !== false },
    LLA_ECOMM: { reportPayment(report) { reports.push(report); return paidResult; } }
  };
  session.setItem('lla_vip_base_v2', JSON.stringify({
    studentId: '1001', orderId: '2001', env: options.env || 'production', payload: {
      ProductID: 26, FirstName: 'Test', LastName: 'Buyer', Email: 'test@example.invalid', MobilePhone: '+12025550123',
      DiscountReason: 'old offer', DynamicParameters: 'cid=118854&utm_source=test&plan=monthly'
    }
  }));
  const context = {
    window, sessionStorage: session, localStorage: local,
    location: { href: 'https://mock.invalid/checkout.html', hostname: 'mock.invalid', search: '' },
    setInterval, clearInterval, fetch: async (url, init) => {
      const call = { url, body: JSON.parse(init.body) };
      calls.push(call);
      if (options.fetch) return options.fetch(call, calls.length);
      return { ok: true, status: 200, json: async () => ({ stid: '1001', orderid: '3001' }) };
    }
  };
  vm.runInNewContext(source, context);
  return { window, calls, reports, local, session, paidResult };
}
const approved = () => ({ StudentId: '1001', OrderId: '2001', IsApproved: true, AmountCharged: '79' });
async function release(s, report = approved()) {
  const returned = s.window.LLA_ECOMM.reportPayment(report);
  assert.equal(returned, s.paidResult, 'original Blueprint payment-report promise is unchanged');
  await s.window.LLA_VIP_ENROLL.lastPromise;
}
test('approved payment creates same-student 100%-discounted order then assigns actual bonus order', async () => {
  const s = setup(), report = approved();
  await release(s, report);
  assert.equal(s.reports[0], report);
  assert.equal(s.calls.length, 2);
  const p = s.calls[0].body;
  assert.match(s.calls[0].url, /\/api\/lead\/ecomm$/);
  assert.equal(p.StudentId, 1001);
  assert.equal(p.MainAbroadCourseId, 283); assert.equal(p.AbroadCourseId, 1823);
  assert.equal(p.CampusId, 4203);
  assert.equal(p.FirstPayment, 0); assert.equal(p.NumberOfPayments, 0); assert.equal(p.LeftToPay, 0);
  assert.equal(p.DiscountPercent, 100); assert.equal('DiscountReason' in p, false);
  assert.equal(p.PreferredCourseId, 170142); assert.equal(p.PrefferdCourseID, 170142);
  assert.equal(p.SemesterID, 2394); assert.equal(p.ActivitySessionLevel1ID, 2394);
  assert.match(p.DynamicParameters, /cid=118854/); assert.match(p.DynamicParameters, /bporder=2001/);
  assert.match(s.calls[1].url, /\/api\/checkout\/assign$/);
  assert.deepEqual(s.calls[1].body, {
    StudentID: 1001, OrderID: 3001, SecondaryCourseID: 170142,
    AssignNotes: 'Included free VIP Masterclass with paid Blueprint order 2001'
  });
  assert.equal(s.window.LLA_VIP_ENROLL.lastResult.ok, true);
});
test('unpaid registration and declined payment cannot create a free order', async () => {
  const s = setup();
  await release(s, { StudentId: '1001', OrderId: '2001' });
  await release(s, { ...approved(), IsApproved: false });
  assert.equal(s.calls.length, 0);
});
test('inactive promotion cannot create bonus order', async () => {
  const s = setup({ active: false });
  await release(s);
  assert.equal(s.calls.length, 0);
});
test('concurrent approved callbacks and later reload create only one bonus order', async () => {
  const s = setup();
  s.window.LLA_ECOMM.reportPayment(approved());
  await release(s);
  await release(s);
  assert.equal(s.calls.length, 2);
  const reloaded = setup({ local: s.local });
  await release(reloaded);
  assert.equal(reloaded.calls.length, 0);
});
test('assignment failure retains bonus IDs and retries assignment, not order creation', async () => {
  let assignmentCount = 0;
  const s = setup({ fetch: async call => {
    if (/\/assign$/.test(call.url)) return { ok: ++assignmentCount > 1, status: assignmentCount > 1 ? 204 : 503 };
    return { ok: true, status: 200, json: async () => ({ StudentId: 1001, OrderId: 3001 }) };
  } });
  await release(s);
  assert.equal(s.window.LLA_VIP_ENROLL.lastResult.status, 'assignment-pending');
  await release(s);
  assert.equal(s.calls.filter(call => /\/ecomm$/.test(call.url)).length, 1);
  assert.equal(s.calls.filter(call => /\/assign$/.test(call.url)).length, 2);
  assert.equal(s.window.LLA_VIP_ENROLL.lastResult.ok, true);
});
test('ambiguous create is never replayed, including after reload', async () => {
  const s = setup({ fetch: async () => { throw new Error('connection lost'); } });
  await release(s); await release(s);
  assert.equal(s.calls.length, 1);
  const reloaded = setup({ local: s.local });
  await release(reloaded);
  assert.equal(reloaded.calls.length, 0);
  assert.equal(reloaded.window.LLA_VIP_ENROLL.lastResult.status, 'confirmation-required');
});
test('unexpected student response never assigns the wrong person', async () => {
  const s = setup({ fetch: async () => ({ ok: true, status: 200, json: async () => ({ stid: 9999, orderid: 3001 }) }) });
  await release(s);
  assert.equal(s.calls.length, 1);
  assert.equal(s.window.LLA_VIP_ENROLL.lastResult.status, 'confirmation-required');
});
test('staging remains isolated from production', async () => {
  const s = setup({ env: 'staging' });
  await release(s);
  assert.ok(s.calls.every(call => call.url.startsWith('https://mock.invalid/staging/api/')));
});
test('normal pre-created checkout quote cannot replace required contact fields with an empty DTO', async () => {
  const s = setup();
  s.session.setItem('lla_vip_base_v2', 'null');
  s.session.setItem('lla_order_quote_v1', JSON.stringify({ stid: '1001', orderid: '2001', firstPayment: 79 }));
  s.session.setItem('lla_checkout_contact_v1', JSON.stringify({
    fullName: 'Current Buyer', email: 'current@example.invalid', phone: '+12025550123', countryIso: 'US'
  }));
  await release(s);
  assert.equal(s.calls[0].body.ProductID, 26);
  assert.equal(s.calls[0].body.FirstName, 'Current'); assert.equal(s.calls[0].body.LastName, 'Buyer');
  assert.equal(s.calls[0].body.Email, 'current@example.invalid'); assert.equal(s.calls[0].body.MobilePhone, '+12025550123');
});
test('a snapshot from a different order cannot leak another buyer into the bonus DTO', async () => {
  const s = setup();
  s.session.setItem('lla_vip_base_v2', JSON.stringify({
    studentId: '9999', orderId: '9998', payload: { Email: 'previous@example.invalid', FirstName: 'Previous' }
  }));
  s.session.setItem('lla_checkout_contact_v1', JSON.stringify({
    fullName: 'Current Buyer', email: 'current@example.invalid', phone: '+12025550123'
  }));
  await release(s);
  assert.equal(s.calls[0].body.Email, 'current@example.invalid');
  assert.equal(s.calls[0].body.StudentId, 1001);
});
test('legacy fire-and-forget attempt is not blindly duplicated', async () => {
  const s = setup();
  s.session.setItem('lla_vip_mc_2001', '1');
  await release(s);
  assert.equal(s.calls.length, 0);
  assert.equal(s.window.LLA_VIP_ENROLL.lastResult.status, 'confirmation-required');
});
