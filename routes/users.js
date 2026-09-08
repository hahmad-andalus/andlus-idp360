// مسارات المستخدمين (الحسابات)
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/usersController');
const { requireAuth, requireRole } = require('../middleware/auth');
const ah = require('../middleware/asyncHandler');

// القراءة متاحة لكل مُصادَق عليه (كل حساب يحتاج قائمة المستخدمين للربط)
router.get('/', requireAuth, ah(ctrl.list));
router.get('/:id', requireAuth, ah(ctrl.getOne));

// الإنشاء/التعديل/الحذف لمدير النظام ومساعده (المساعد لا يمسّ حسابات المدراء — يُتحقّق داخل المتحكّم/الواجهة)
router.post('/', requireAuth, requireRole('admin','admin_assistant'), ah(ctrl.create));
router.put('/:id', requireAuth, requireRole('admin','admin_assistant'), ah(ctrl.update));
router.delete('/:id', requireAuth, requireRole('admin','admin_assistant'), ah(ctrl.remove));

// تعيين زملاء التقييم — لكل مستخدم مُصادَق عليه (مدراء/متابعون/موظفون)
router.put('/:id/peers', requireAuth, ah(ctrl.assignPeers));

module.exports = router;
