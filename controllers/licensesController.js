// ═══════════════════════════════════════════════════════════════
// متحكّم الرخصة المهنية (v104)
// سجلٌّ واحدٌ لكل موظف: آخر إجابة + التواريخ + المرفق (Base64)
// نمط مطابق لقياس الأثر؛ المرفق يُخزَّن في عمود نصّي (att_data) ويُعاد كما هو.
// ═══════════════════════════════════════════════════════════════
const { db } = require('../db');
const perm = require('../config/permissions');

// حالة نافذة فرعٍ ما (مفتوحة/مغلقة) — تُستخدم لفرض الكتابة عند الفتح فقط
function branchWindowOpen(branch) {
  const w = db.prepare('SELECT is_open, close_date FROM license_windows WHERE branch = ?').get(branch);
  if (!w || !w.is_open) return false;
  if (w.close_date && w.close_date < new Date().toISOString().split('T')[0]) return false;
  return true;
}

// ─── قراءة بيانات الرخصة (كل من يراهم القارئ) ───
// GET /api/licenses  → { licenses: { empId: {mainAnswer, subAnswer, date, hasAttachment, attName, attType, updatedBy, updatedAt} } }
// v148 (خفض الـ Egress وانهيار الذاكرة): لا نُعيد att_data (الصورة Base64) في القائمة إطلاقاً — كان نقلها
//   لكلّ السجلّات في كلّ تحميل (مئات الميجا) يُثقل الشبكة ويُنفد ذاكرة المتصفّح. نُعيد علامة hasAttachment
//   فقط، وتُجلب الصورة عند الطلب من المسار المنفصل GET /licenses/:employeeId/attachment.
function listLicenses(req, res) {
  const actor = perm.loadUser(req.user.id);
  const visible = new Set(
    perm.loadAllUsers().filter(u => perm.canReadEmployee(actor, u)).map(u => u.id)
  );
  // لا نختار att_data — فقط علامة وجوده (att_data IS NOT NULL) واسمه/نوعه الخفيفين.
  const rows = db.prepare(`SELECT employee_id, main_answer, sub_answer, the_date, att_name, att_type,
      (att_data IS NOT NULL AND att_data <> '') AS has_att, updated_by, updated_at FROM licenses`)
    .all().filter(r => visible.has(r.employee_id));
  const out = {};
  rows.forEach(r => {
    out[r.employee_id] = {
      mainAnswer: r.main_answer || '',
      subAnswer: r.sub_answer || '',
      date: r.the_date || '',
      hasAttachment: !!r.has_att,
      attName: r.att_name || '',
      attType: r.att_type || '',
      updatedBy: r.updated_by || '',
      updatedAt: r.updated_at || '',
    };
  });
  res.json({ licenses: out });
}

// ─── جلب مرفق رخصة موظفٍ واحد عند الطلب فقط ───
// GET /api/licenses/:employeeId/attachment → { attachment: {name,type,data} | null }
// v148: الصورة تُنقل فقط حين يضغط المستخدم «عرض المرفق»، لا في كلّ تحميل للقائمة.
function getLicenseAttachment(req, res) {
  const empId = req.params.employeeId;
  const actor = perm.loadUser(req.user.id);
  const target = perm.loadUser(empId);
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (!perm.canReadEmployee(actor, target)) {
    return res.status(403).json({ error: 'لا تملك صلاحية الاطّلاع على مرفق هذا الموظف' });
  }
  const r = db.prepare('SELECT att_name, att_type, att_data FROM licenses WHERE employee_id = ?').get(empId);
  const attachment = (r && r.att_data) ? { name: r.att_name || '', type: r.att_type || '', data: r.att_data } : null;
  res.json({ attachment });
}

// ─── حفظ/تحديث بيانات رخصة موظف ───
// PUT /api/licenses/:employeeId
// body: { mainAnswer, subAnswer, date, attachment:{name,type,data}|null }
// يكتبها صاحبها (عند فتح نافذة فرعه) أو مدير النظام.
function saveLicense(req, res) {
  const empId = req.params.employeeId;
  const body = req.body || {};
  const { mainAnswer = '', subAnswer = '', date = '' } = body;
  // v148: المرفق لم يعد يصل مع القائمة، فالواجهة لا ترسله إلا إذا غُيِّر فعلاً. نميّز ثلاث حالات:
  //   • المفتاح غائب (attachment === undefined) → «لم يُمَسّ» → نُبقي att_data المخزَّن كما هو.
  //   • attachment === null → «أُزيل» → نمحو att_data.
  //   • attachment كائن → «جديد» → نستبدل att_data.
  const attachmentTouched = Object.prototype.hasOwnProperty.call(body, 'attachment');
  const attachment = body.attachment;

  const actor = perm.loadUser(req.user.id);
  const target = perm.loadUser(empId);
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' });

  // صلاحية الكتابة: مدير النظام، أو صاحب البيانات نفسه
  const isSelf = actor.id === target.id;
  if (!perm.isAdmin(actor) && !isSelf) {
    return res.status(403).json({ error: 'لا تملك صلاحية تعديل بيانات رخصة هذا الموظف' });
  }
  // صاحب البيانات لا يكتب إلا إذا كان حصر فرعه مفتوحاً (مدير النظام يكتب دائماً)
  if (isSelf && !perm.isAdmin(actor) && !branchWindowOpen(target.branch)) {
    return res.status(403).json({ error: 'حصر الرخصة المهنية مغلق لفرعك حاليّاً' });
  }

  // حدّ حجم المرفق (≈1م.ب أصلي → ~1.4م.ب Base64) — نقبل حتى 2م.ب نصّاً احتياطاً
  if (attachment && attachment.data && attachment.data.length > 2_000_000) {
    return res.status(413).json({ error: 'حجم المرفق كبير جدّاً (الحدّ ~1 ميجابايت)' });
  }

  const existing = db.prepare('SELECT att_name, att_type, att_data FROM licenses WHERE employee_id = ?').get(empId);
  // قيمة المرفق التي ستُكتب: إن لم يُمَسّ نُبقي المخزَّن؛ وإلا نأخذ الجديد (أو نمحو عند null).
  const att = !attachmentTouched
    ? (existing || { att_name: null, att_type: null, att_data: null })
    : { att_name: attachment ? (attachment.name || null) : null,
        att_type: attachment ? (attachment.type || null) : null,
        att_data: attachment ? (attachment.data || null) : null };

  db.prepare(`INSERT INTO licenses (employee_id, main_answer, sub_answer, the_date, att_name, att_type, att_data, updated_by, updated_at)
    VALUES (@eid,@ma,@sa,@dt,@an,@at,@ad,@ub,@uat)
    ON CONFLICT(employee_id) DO UPDATE SET
      main_answer=@ma, sub_answer=@sa, the_date=@dt, att_name=@an, att_type=@at, att_data=@ad, updated_by=@ub, updated_at=@uat`)
    .run({
      eid: empId, ma: mainAnswer || null, sa: subAnswer || null, dt: date || null,
      an: att.att_name, at: att.att_type, ad: att.att_data,
      ub: actor.name || actor.id, uat: new Date().toISOString().split('T')[0],
    });
  res.json({ ok: true });
}

// ─── نوافذ حصر الرخصة (لكل فرع) ───
// GET /api/license-windows → { branches: { branch: {isOpen, openDate, closeDate} } }
function getLicenseWindows(req, res) {
  const rows = db.prepare('SELECT * FROM license_windows').all();
  const branches = {};
  rows.forEach(r => { branches[r.branch] = { isOpen: !!r.is_open, openDate: r.open_date, closeDate: r.close_date }; });
  res.json({ branches });
}
// POST /api/license-windows  body:{ branch, isOpen, openDate, closeDate } — مدير النظام فقط (يُفرض في المسار)
function setLicenseWindow(req, res) {
  const { branch, isOpen, openDate, closeDate } = req.body || {};
  if (!branch) return res.status(400).json({ error: 'الفرع مطلوب' });
  db.prepare(`INSERT INTO license_windows (branch,is_open,open_date,close_date)
    VALUES (@branch,@io,@od,@cd)
    ON CONFLICT(branch) DO UPDATE SET is_open=@io, open_date=@od, close_date=@cd`)
    .run({ branch, io: isOpen ? 1 : 0, od: openDate || null, cd: closeDate || null });
  res.json({ ok: true });
}

module.exports = { listLicenses, getLicenseAttachment, saveLicense, getLicenseWindows, setLicenseWindow };
