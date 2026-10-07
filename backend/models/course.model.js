const mongoose = require('mongoose');

// A course the campus runs (e.g. Management, Art, Law ...). Batches belong to a course.
// A batch stores the course NAME in its "faculty" field, so renaming a course also
// renames it on its batches and salary records (see renameCourse in the salary service).
const courseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// "management" and "Management" are the same course.
courseSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = mongoose.model('Course', courseSchema);
