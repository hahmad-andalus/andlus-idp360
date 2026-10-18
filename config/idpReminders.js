// ═══════════════════════════════════════════════════════════════
// إشعارات «٧ أيّام على بدء بندٍ تطويريّ معتمد» (v109)
// يفحص يوميّاً (منتصف يوم الرياض) كل البنود، ويُرسل لبريد الموظف إشعاراً
// قبل ٧ أيّام بالضبط من تاريخ البدء (target_date)، لمرّةٍ واحدةٍ فقط لكل بند.
// الشرط: الخطة معتمدةٌ اعتماداً نهائيّاً (branch_finance_approved = 1).
// الإرسال بنفس آليّة استعادة كلمة السر (config/mailer).
// ═══════════════════════════════════════════════════════════════
const { db } = require('../db');
const { sendIdpReminder } = require('./mailer');

// تاريخ اليوم + n يوماً بصيغة YYYY-MM-DD (بتوقيت الرياض UTC+3)
function riyadhDatePlus(days) {
  const now = new Date(Date.now() + 3 * 3600 * 1000); // انتقل لتوقيت الرياض
  now.setUTCDate(now.getUTCDate() + days);
  return now.toISOString().split('T')[0];
}

// يُنفّذ فحص الإشعارات مرّةً. يُرجع عدد ما أُرسِل.
async function runIdpReminders() {
  const targetDay = riyadhDatePlus(7); // البنود التي تبدأ بعد ٧ أيّام بالضبط
  let sent = 0, skipped = 0, failed = 0;

  // البنود المرشّحة: تاريخ بدؤها = اليوم+٧، لخطةٍ معتمدةٍ نهائيّاً، ولم يُرسَل إشعارها
  let rows;
  try {
    rows = db.prepare(`
      SELECT r.id AS row_id, r.employee_id, r.program_name, r.target_date,
             u.username, u.name,
             i.branch_finance_approved
      FROM idp_rows r
      JOIN idps  i ON i.employee_id = r.employee_id
      JOIN users u ON u.id = r.employee_id
      WHERE r.target_date = ?
        AND i.branch_finance_approved = 1
    `).all(targetDay);
  } catch (e) {
    console.error('⚠️ فحص تذكيرات الخطط: خطأ في الاستعلام:', e.message);
    return 0;
  }

  for (const row of rows) {
    // تجاوز ما أُشعِر سابقاً (مرّة واحدة لكل بند)
    const already = db.prepare('SELECT 1 FROM idp_reminders WHERE row_id = ?').get(row.row_id);
    if (already) { skipped++; continue; }
    // بريد الموظف = اسم المستخدم (يجب أن يكون بريداً صالحاً)
    const email = String(row.username || '').trim();
    if (!email || !email.includes('@')) { skipped++; continue; }
    try {
      await sendIdpReminder(email, row.name, {
        programName: row.program_name,
        targetDate: row.target_date,
      });
      db.prepare('INSERT OR IGNORE INTO idp_reminders (row_id, employee_id, target_date) VALUES (?,?,?)')
        .run(row.row_id, row.employee_id, row.target_date);
      sent++;
    } catch (e) {
      failed++;
      console.error(`⚠️ فشل إرسال تذكير البند ${row.row_id} إلى ${email}:`, e.message);
    }
  }

  if (sent || failed) {
    console.log(`📧 تذكيرات الخطط (${targetDay}): أُرسل ${sent}، تُخطّي ${skipped}، فشل ${failed}`);
  }
  return sent;
}

// جدولة يوميّة عند منتصف يوم الرياض (12:00 ظهراً = 09:00 UTC).
// نفحص كل ١٠ دقائق: إن كانت الساعة ٠٩ UTC ولم نُنفّذ اليوم، نُنفّذ مرّةً.
function startIdpReminderSchedule() {
  let lastRunDay = null;
  const check = () => {
    const nowUtc = new Date();
    const hourUtc = nowUtc.getUTCHours();          // 09 UTC = 12 ظهراً رياض
    const today = riyadhDatePlus(0);
    if (hourUtc === 9 && lastRunDay !== today) {
      lastRunDay = today;
      runIdpReminders().catch(e => console.error('تذكيرات الخطط:', e.message));
    }
  };
  setInterval(check, 10 * 60 * 1000); // كل ١٠ دقائق
  check(); // فحصٌ أوّليّ عند الإقلاع
  console.log('⏰ جدولة تذكيرات الخطط مُفعّلة (منتصف يوم الرياض)');
}

module.exports = { runIdpReminders, startIdpReminderSchedule };
