import mongoose from 'mongoose';

const testimonialSchema = new mongoose.Schema({
  authorName: {
    type: String,
    required: true
  },
  authorTitle: {
    type: String
  },
  content: {
    type: String,
    required: true,
    minlength: 20
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  approved: {
    type: Boolean,
    default: false
  },
  approvedAt: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  featured: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Testimonial = mongoose.model('Testimonial', testimonialSchema);

export default Testimonial;
