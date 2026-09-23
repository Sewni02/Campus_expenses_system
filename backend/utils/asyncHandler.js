// Wraps an async Express route/controller function so that any rejected
// promise (thrown error) is forwarded to next(err) automatically, instead of
// every controller needing its own try/catch + console.error + res.status(500).
//
// Before:
//   const getHardware = async (req, res) => {
//     try {
//       const hardware = await Hardware.find();
//       res.json(hardware);
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ message: 'Server error' });
//     }
//   };
//
// After:
//   const getHardware = asyncHandler(async (req, res) => {
//     const hardware = await Hardware.find();
//     res.json(hardware);
//   });
//
// The centralized error handler in server.js (last middleware) is what
// actually turns the forwarded error into a response.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;