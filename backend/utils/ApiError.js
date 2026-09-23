// A throwable error that already carries the HTTP status code it should
// produce. Lets controllers do:
//
//   const hardware = await Hardware.findById(id);
//   if (!hardware) throw new ApiError(404, 'Hardware supplier not found');
//
// instead of:
//
//   const hardware = await Hardware.findById(id);
//   if (!hardware) return res.status(404).json({ message: 'Hardware supplier not found' });
//
// Combined with asyncHandler, the throw is caught automatically and handed
// to the centralized error handler in server.js, which reads
// err.statusCode.
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Small helper for the very common "find a document or fail with 404"
// pattern that was repeated in nearly every controller across the app.
//
//   const hardware = await findOrFail(Hardware, id, 'Hardware supplier not found');
//
// Also turns an invalid/malformed :id (Mongoose CastError) into a clean
// 404 instead of leaking a 500 "Server error".
const findOrFail = async (Model, id, notFoundMessage) => {
  let doc;
  try {
    doc = await Model.findById(id);
  } catch (err) {
    if (err.name === 'CastError') {
      throw new ApiError(404, notFoundMessage);
    }
    throw err;
  }
  if (!doc) {
    throw new ApiError(404, notFoundMessage);
  }
  return doc;
};

module.exports = { ApiError, findOrFail };