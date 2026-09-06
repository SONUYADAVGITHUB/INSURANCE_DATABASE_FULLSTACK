// Express doesn't automatically forward rejected promises from async
// route handlers to the error-handling middleware. Wrapping each handler
// with this keeps every controller free of repetitive try/catch blocks.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
