// ═══════════════════════════════════════════════════════════════
// وحدة إرسال البريد — ج-3 (نسيت كلمة السر)
// في التطوير: تطبع الرابط في السجل. في الإنتاج: تُرسل عبر SMTP إن ضُبطت المتغيّرات.
//
// للتفعيل الفعلي على السيرفر، اضبط متغيّرات البيئة التالية:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// وثبّت الحزمة: npm install nodemailer
// ═══════════════════════════════════════════════════════════════

let transporter = null;
let nodemailer = null;

function initTransporter() {
  if (transporter !== null) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER) {
    transporter = false; // غير مضبوط — سنطبع في السجل بدلاً من الإرسال
    return transporter;
  }
  try {
    nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  } catch (e) {
    console.warn('⚠️  nodemailer غير مثبّت — سيُطبع رابط إعادة التعيين في السجل. ثبّت: npm install nodemailer');
    transporter = false;
  }
  return transporter;
}

// يرسل بريد إعادة تعيين كلمة المرور. يُرجع true إن أُرسل فعلياً، false إن طُبع فقط.
async function sendPasswordReset(toEmail, resetLink, userName) {
  const t = initTransporter();
  const subject = 'إعادة تعيين كلمة المرور — منصة الأندلس للتطوّر المهني';
  const text = `مرحباً ${userName || ''}،\n\nلإعادة تعيين كلمة المرور، افتح الرابط التالي (صالح لمدة ساعة):\n${resetLink}\n\nإن لم تطلب ذلك، تجاهل هذه الرسالة.\n\nشركة الأندلس التعليمية`;
  const html = `<div dir="rtl" style="font-family:sans-serif;color:#15385C">
    <h2>إعادة تعيين كلمة المرور</h2>
    <p>مرحباً ${userName || ''}،</p>
    <p>لإعادة تعيين كلمة مرور حسابك في منصة الأندلس للتطوّر المهني، اضغط الزرّ التالي (صالح لمدة ساعة):</p>
    <p><a href="${resetLink}" style="background:#15385C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">إعادة تعيين كلمة المرور</a></p>
    <p style="color:#5B7A9E;font-size:13px">إن لم تطلب ذلك، تجاهل هذه الرسالة.</p>
    <p style="color:#5B7A9E;font-size:13px">شركة الأندلس التعليمية</p>
  </div>`;

  if (!t) {
    // لا SMTP مضبوط — نطبع الرابط (للتطوير/الاختبار)
    console.log('\n📧 [بريد إعادة التعيين — لم يُرسل فعلياً، اضبط SMTP للإرسال]');
    console.log(`   إلى: ${toEmail}`);
    console.log(`   الرابط: ${resetLink}\n`);
    return false;
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject, text, html,
  });
  return true;
}

// ─── v109: إشعار «٧ أيّام على بدء بندٍ تطويريّ معتمد» ───
// يُرسَل لبريد الموظف (اسم المستخدم) بنفس آليّة إرسال استعادة كلمة السر.
async function sendIdpReminder(toEmail, userName, item) {
  const t = initTransporter();
  const prog = (item && item.programName) ? item.programName : 'بندك التطويري';
  const date = (item && item.targetDate) ? item.targetDate : '';
  const subject = 'تذكير: ٧ أيّام على بدء بندٍ تطويريّ في خطتك — منصة الأندلس';
  const text = `مرحباً ${userName || ''}،\n\nنذكّرك بأنه تبقّى ٧ أيّام على بدء تنفيذ البند التطويري المعتمد في خطة التطوّر المهني الخاصة بك:\n\n• البند: ${prog}\n• تاريخ البدء: ${date}\n\nنتمنّى لك التوفيق في تنفيذه.\n\nشركة الأندلس التعليمية`;
  const html = `<div dir="rtl" style="font-family:'Cairo',sans-serif;color:#15385C;line-height:1.9;max-width:560px">
    <div style="background:linear-gradient(135deg,#1D5A8A,#2E7FB8);color:#fff;padding:20px 24px;border-radius:16px 16px 0 0">
      <div style="font-size:19px;font-weight:800">⏰ تذكير بموعد بندٍ تطويريّ</div>
      <div style="font-size:13px;opacity:0.9;margin-top:4px">منصة التطوّر المهني — شركة الأندلس التعليمية</div>
    </div>
    <div style="background:#fff;border:1px solid #E3EEF9;border-top:none;padding:22px 24px;border-radius:0 0 16px 16px">
      <p style="margin:0 0 14px">مرحباً <b>${userName || ''}</b>،</p>
      <p style="margin:0 0 16px">تبقّى <b style="color:#2E7FB8">٧ أيّام</b> على بدء تنفيذ البند التطويري المعتمد في خطة التطوّر المهني الخاصة بك:</p>
      <div style="background:#F4F9FE;border:1px solid #DDE9F5;border-radius:12px;padding:14px 16px;margin-bottom:16px">
        <div style="font-size:12px;color:#5B7A9E;margin-bottom:4px">📘 البند التطويري</div>
        <div style="font-size:15px;font-weight:800;color:#15385C;margin-bottom:10px">${prog}</div>
        <div style="font-size:12px;color:#5B7A9E;margin-bottom:4px">📅 تاريخ البدء</div>
        <div style="font-size:15px;font-weight:800;color:#059669">${date}</div>
      </div>
      <p style="margin:0;color:#5B7A9E;font-size:13px">نتمنّى لك التوفيق في تنفيذه. 🌿</p>
      <p style="margin:14px 0 0;color:#8CA3BD;font-size:12px">شركة الأندلس التعليمية</p>
    </div>
  </div>`;

  if (!t) {
    console.log('\n📧 [تذكير بند تطويري — لم يُرسل فعلياً، اضبط SMTP]');
    console.log(`   إلى: ${toEmail} | البند: ${prog} | البدء: ${date}\n`);
    return false;
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject, text, html,
  });
  return true;
}

module.exports = { sendPasswordReset, sendIdpReminder };
