// ═══════════════════════════════════════════════════════════════
// v150: الاستبدال الجماعي لبنود الخطط (أداة مدير النظام)
//
// الغرض: استبدال بند جدارةٍ لفئةٍ معيّنة (أساسية/عامة/فنية) بدورةٍ جديدة
//   موحّدة، لمجموعة موظفين تُحدَّد بالفرع/المرحلة/قائمة أفراد — في عملية
//   خادمية واحدة بدل آلاف الحفظات من الواجهة.
//
// ملف مستقلّ تماماً: لا يلمس idpsController ولا منطق الحفظ/الاعتماد القائم.
//   يعمل مباشرةً على جدول idp_rows عبر SQL. لا يُغيّر رأس الخطة (idps)
//   إطلاقاً، فحالة الاعتماد تبقى كما هي (المعتمَدة معتمَدة، وغيرها كما هي).
//
// الأمان:
//   • المسار محميّ بـ requireRole('admin') في طبقة المسارات.
//   • لا يكتب شيئاً إلا إذا كان confirm === true و dryRun !== true.
//   • dryRun (المعاينة) يُرجع العدد والتفصيل دون أي كتابة.
// ═══════════════════════════════════════════════════════════════
const { db } = require('../db');
const crypto = require('crypto');

const VALID_CATS = ['أساسية', 'عامة', 'فنية'];

// يبني شرط الموظفين المطابقين للفلاتر (فرع/مرحلة/أفراد) ويُعيد قائمة المعرّفات.
function matchedEmployeeIds(filters) {
  const f = filters || {};
  const where = [];
  const args = [];
  // لا نشمل إلا الأدوار التي لها خطط تطوير (كما في الواجهة): معلّم/تخصصي/امتداد فني
  where.push("role IN ('employee','specialist','branch_ext')");
  if (f.branch) { where.push('branch = ?'); args.push(f.branch); }
  if (f.stage) { where.push('stage = ?'); args.push(f.stage); }
  let ids = db.prepare(`SELECT id FROM users WHERE ${where.join(' AND ')}`).all(...args).map(r => r.id);
  // تحديد أفراد بعينهم (اختياري): تقاطُع مع ناتج الفلاتر أعلاه
  if (Array.isArray(f.employeeIds) && f.employeeIds.length) {
    const sel = new Set(f.employeeIds.map(String));
    ids = ids.filter(id => sel.has(String(id)));
  }
  return ids;
}

// يجمع، لمجموعة الموظفين، مَن لديه فعلاً بند من الفئة المطلوبة (المرشّحون للاستبدال).
// يُعيد: { category, totalInScope, affected:[{id,name,branch,stage,oldName}], byBranch:{br:count} }
function computeTargets(category, empIds) {
  const out = { totalInScope: empIds.length, affected: [], byBranch: {} };
  if (!empIds.length) return out;
  // نقرأ البنود من الفئة المطلوبة لهؤلاء الموظفين (أول بند لكلّ موظف يكفي للعرض)
  const qMarks = empIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT r.employee_id AS eid, r.program_name AS pname,
            u.name AS uname, u.branch AS ubranch, u.stage AS ustage
       FROM idp_rows r JOIN users u ON u.id = r.employee_id
      WHERE r.cat = ? AND r.employee_id IN (${qMarks})
      ORDER BY u.branch, u.stage, u.name, r.sort_order`
  ).all(category, ...empIds);
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.eid)) continue;      // موظف واحد مرّة واحدة في العرض
    seen.add(r.eid);
    out.affected.push({ id: r.eid, name: r.uname, branch: r.ubranch || '—', stage: r.ustage || '—', oldName: r.pname || '—' });
    const b = r.ubranch || '—';
    out.byBranch[b] = (out.byBranch[b] || 0) + 1;
  }
  return out;
}

// POST /api/idps/bulk-replace
// body: {
//   filters:{ branch?, stage?, employeeIds?[] },
//   category: 'عامة'|'أساسية'|'فنية',
//   course:{ programName, provider?, url?, cost?, hours?, trainMethod?, evalMethod?, needSource?, targetDate?, status? },
//   dryRun?: true,          // معاينة فقط (الافتراضي الآمن)
//   confirm?: true          // لازمة للتنفيذ الفعلي
// }
function bulkReplace(req, res) {
  const b = req.body || {};
  const category = (b.category || '').trim();
  const course = b.course || {};
  const dryRun = b.dryRun !== false ? true : false; // الافتراضي معاينة ما لم يُصرّح بغيرها
  // تحقّق المدخلات
  if (!VALID_CATS.includes(category)) {
    return res.status(400).json({ error: 'فئة جدارة غير صحيحة (المسموح: أساسية/عامة/فنية)' });
  }
  const empIds = matchedEmployeeIds(b.filters);
  const targets = computeTargets(category, empIds);

  // المعاينة: لا كتابة
  if (dryRun) {
    return res.json({
      ok: true, dryRun: true, category,
      totalInScope: targets.totalInScope,
      affectedCount: targets.affected.length,
      byBranch: targets.byBranch,
      affected: targets.affected,     // للعرض في جدول المعاينة
    });
  }

  // التنفيذ الفعلي — يستلزم اسم دورة جديدة وتأكيداً صريحاً
  if (!course.programName || !String(course.programName).trim()) {
    return res.status(400).json({ error: 'اسم الدورة الجديدة مطلوب للتنفيذ' });
  }
  if (b.confirm !== true) {
    return res.status(400).json({ error: 'التنفيذ يتطلّب تأكيداً صريحاً (confirm=true)' });
  }
  if (!targets.affected.length) {
    return res.json({ ok: true, dryRun: false, replaced: 0, byBranch: {}, note: 'لا يوجد موظفون مطابقون للاستبدال' });
  }

  const affectedIds = targets.affected.map(a => a.id);

  // داخل معاملة واحدة: لكل موظف مطابق، نحوّل أول بند من الفئة إلى الدورة الجديدة.
  //   نُبقي id البند و sort_order كما هما (لا نحذف ونُدرج) حفاظاً على ترتيب الخطة ومرجعيّتها.
  //   إن كان لموظف أكثر من بند في الفئة (غير متوقّع بإقرار العميل) نُحدّث الأول فقط ونترك الباقي.
  const upd = db.prepare(
    `UPDATE idp_rows SET
        program_name = @program_name,
        provider     = @provider,
        url          = @url,
        cost         = @cost,
        hours        = @hours,
        train_method = @train_method,
        eval_method  = @eval_method,
        need_source  = @need_source,
        target_date  = @target_date,
        status       = @status
      WHERE id = @row_id`
  );
  const pick = db.prepare(
    `SELECT id FROM idp_rows WHERE employee_id = ? AND cat = ? ORDER BY sort_order LIMIT 1`
  );

  const vals = {
    program_name: String(course.programName).trim(),
    provider: course.provider != null ? String(course.provider) : null,
    url: course.url != null ? String(course.url) : null,
    cost: course.cost != null ? String(course.cost) : null,
    hours: course.hours != null ? String(course.hours) : null,
    train_method: course.trainMethod != null ? String(course.trainMethod) : null,
    eval_method: course.evalMethod != null ? String(course.evalMethod) : null,
    need_source: course.needSource != null ? String(course.needSource) : null,
    target_date: course.targetDate != null ? String(course.targetDate) : null,
    status: course.status != null && String(course.status).trim() ? String(course.status) : 'لم يتم التنفيذ',
  };

  let replaced = 0;
  const tx = db.transaction(() => {
    for (const eid of affectedIds) {
      const row = pick.get(eid, category);
      if (!row) continue;                 // تغيّر بين المعاينة والتنفيذ — نتجاوزه بأمان
      upd.run({ ...vals, row_id: row.id });
      replaced++;
    }
    // تحديث طابع زمني لرأس خطط المتأثّرين (لا يمسّ حالة الاعتماد)
    const stamp = db.prepare(`UPDATE idps SET updated_at = datetime('now') WHERE employee_id = ?`);
    for (const eid of affectedIds) stamp.run(eid);
  });
  tx();

  res.json({ ok: true, dryRun: false, category, replaced, byBranch: targets.byBranch });
}

module.exports = { bulkReplace };
