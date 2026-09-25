const mongoose = require('mongoose');

const contactSubmissionSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String },
  phone: { type: String, required: true },
  subject: { type: String },
  message: { type: String },
  company: { type: String },
  acreage: { type: String },
  type: { type: String, enum: ['contact', 'bulkorder', 'general'], default: 'general' },
  status: { type: String, enum: ['new', 'contacted', 'converted'], default: 'new' },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ContactSubmission', contactSubmissionSchema);
