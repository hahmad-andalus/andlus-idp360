// ═══════════════════════════════════════════════════════════════
// يحوّل ملفات قاعدة منزّلة من القرص (andlus.db + -wal + -shm) إلى
// نسخة احتياطية واحدة مكتفية بذاتها، ويتحقّق من سلامتها ويعرض محتواها.
//
//   node scripts/backup_finalize.js <مجلد-التنزيل> [ملف-الخرج]
//
// مثال:
//   node scripts/backup_finalize.js "C:\backups\2026-08-09"
// ═══════════════════════════════════════════════════════════════
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) {
  console.error('الاستخدام: node scripts/backup_finalize.js <مجلد-التنزيل> [ملف-الخرج]');
  process.exit(1);
}
const src = path.join(dir, 'andlus.db');
if (!fs.existsSync(src)) { console.error('لم أجد andlus.db داخل: ' + dir); process.exit(1); }

const stamp = new Date().toISOString().slice(0, 10);
const out = process.argv[3] || path.join(dir, `andlus-backup-${stamp}.db`);

// حالة الملفات قبل الدمج — تكشف كم من البيانات كان في WAL
const sizeOf = (p) => (fs.existsSync(p) ? fs.statSync(p).size : 0);
const mainSize = sizeOf(src), walSize = sizeOf(src + '-wal');
console.log('\nالملفات المنزّلة:');
console.log('  andlus.db      ' + mainSize.toLocaleString() + ' بايت');
console.log('  andlus.db-wal  ' + walSize.toLocaleString() + ' بايت' + (walSize === 0 ? '  (غير موجود)' : ''));
if (walSize > mainSize) {
  console.log('\n  ⚠️  ملف WAL أكبر من القاعدة نفسها — أي أن معظم بياناتك فيه.');
  console.log('      لو نسخت andlus.db وحده لكانت النسخة شبه فارغة.');
}

for (const f of [out, out + '-wal', out + '-shm']) if (fs.existsSync(f)) fs.unlinkSync(f);

const db = new Database(src);
db.pragma('wal_checkpoint(TRUNCATE)');                       // ادمج WAL في القاعدة
db.exec(`VACUUM INTO '${out.replace(/\\/g, '/').replace(/'/g, "''")}'`);  // ملف نظيف واحد
db.close();

const v = new Database(out, { readonly: true });
const integrity = v.pragma('integrity_check')[0].integrity_check;
const fk = v.pragma('foreign_key_check').length;
console.log('\nالتحقّق:');
console.log('  integrity_check    ' + integrity + (integrity === 'ok' ? ' ✅' : ' ❌'));
console.log('  foreign_key_check  ' + (fk === 0 ? 'ok ✅' : fk + ' انتهاك ❌'));
console.log('  ملفات جانبية       ' + (['-wal', '-shm'].some(s => fs.existsSync(out + s)) ? 'موجودة ❌' : 'لا شيء ✅'));

const n = (t) => { try { return v.prepare(`SELECT COUNT(*) n FROM "${t}"`).get().n; } catch { return '—'; } };
console.log('\nالمحتوى:');
for (const t of ['users', 'settings', 'eval_scores', 'idps', 'idp_rows', 'eval_windows', 'audit_log']) {
  console.log('  ' + t.padEnd(14) + n(t));
}
let jobCount = 0;
try {
  const jobs = JSON.parse(v.prepare("SELECT value FROM settings WHERE skey='jobs'").get().value);
  const comps = JSON.parse(v.prepare("SELECT value FROM settings WHERE skey='comps'").get().value);
  jobCount = Object.keys(jobs).length;
  console.log('  المسميات        ' + jobCount);
  console.log('  الجدارات        ' + Object.keys(comps).length);
} catch {}

// يُحسب قبل الإغلاق — بعده تفشل الاستعلامات صامتةً فتبدو النسخة الفارغة سليمة
const empty = n('users') <= 1 && n('eval_scores') === 0 && jobCount === 0;
v.close();
console.log('\n' + (integrity === 'ok' && fk === 0 && !empty
  ? '✅ النسخة سليمة وجاهزة: ' + out
  : '⚠️  راجع النتائج أعلاه قبل الاعتماد على هذه النسخة: ' + out) + '\n');
