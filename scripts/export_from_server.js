// ═══════════════════════════════════════════════════════════════
// يسحب كل البيانات المقروءة من خادم مُشغَّل عبر واجهة التطبيق ويحفظها JSON.
//
//   node scripts/export_from_server.js <baseUrl> <adminUser> <adminPass> [ملف-الخرج]
//
// ⚠️ ليست بديلاً عن نسخة ملف القاعدة: كلمات المرور المُجزّأة وسجلّ التدقيق
//    لا يمكن قراءتهما عبر الـ API. استخدمها كشبكة أمان للبيانات لا للحسابات.
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');

const [BASE, USER, PASS] = process.argv.slice(2);
if (!BASE || !USER || !PASS) {
  console.error('الاستخدام: node scripts/export_from_server.js <baseUrl> <adminUser> <adminPass> [ملف-الخرج]');
  process.exit(1);
}
const OUT = process.argv[5] || `andlus-export-${new Date().toISOString().slice(0, 10)}.json`;

(async () => {
  const lr = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!lr.ok) { console.error('فشل الدخول: HTTP ' + lr.status); process.exit(1); }
  const H = { authorization: 'Bearer ' + (await lr.json()).token };

  const get = async (p) => {
    const r = await fetch(BASE + p, { headers: H });
    if (!r.ok) return { __error: 'HTTP ' + r.status };
    return r.json();
  };

  const snap = { exportedAt: new Date().toISOString(), source: BASE };
  const parts = [
    ['users', '/api/users'], ['settings', '/api/settings'], ['idps', '/api/idps'],
    ['impact', '/api/impact'], ['approvals', '/api/approvals'], ['windows', '/api/windows'],
    ['editRequests', '/api/edit-requests'], ['twice', '/api/twice'], ['round2', '/api/round2'],
    ['courses', '/api/courses'], ['readings', '/api/readings'], ['locks', '/api/evals/locks'],
    ['accountRequests', '/api/account-requests'],
  ];
  for (const [name, p] of parts) {
    snap[name] = await get(p);
    const v = snap[name];
    const inner = v && typeof v === 'object' ? Object.values(v)[0] : v;
    const n = Array.isArray(inner) ? inner.length : (inner && typeof inner === 'object' ? Object.keys(inner).length : '—');
    console.log('  ' + name.padEnd(16) + n);
  }

  // التقييمات: المسار الجماعي إن وُجد، وإلا طلب لكل موظف
  let evals = await get('/api/evals');
  if (!evals || !evals.evals) {
    evals = { evals: {} };
    for (const u of (snap.users.users || [])) {
      if (u.role === 'admin') continue;
      evals.evals[u.id] = await get('/api/evals/' + u.id);
    }
  }
  snap.evals = evals;
  console.log('  ' + 'evals'.padEnd(16) + Object.keys(evals.evals || {}).length);

  fs.writeFileSync(OUT, JSON.stringify(snap, null, 2), 'utf8');
  const jobs = Object.keys((snap.settings.settings || {}).jobs || {}).length;
  console.log('\n  المسميات الوظيفية : ' + jobs);
  console.log('  الحسابات          : ' + (snap.users.users || []).length);
  console.log('  الحجم             : ' + fs.statSync(OUT).size.toLocaleString() + ' بايت');
  console.log('\n✅ حُفظت في: ' + OUT);
  console.log('⚠️  لا تحوي كلمات المرور المُجزّأة ولا سجلّ التدقيق — للبيانات لا للحسابات.\n');
})();
