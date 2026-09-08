// يلفّ متحكّماً async فيوجّه أي خطأ (متزامن أو async) إلى معالج أخطاء Express
// بدل أن يتسرّب كـunhandledRejection ويُسقط الخادم.
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
