import mongoose from 'mongoose';

const quoteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  projectDetails: {
    type: String,
    required: true,
  },
  adminNotes: {
    type: String,
    default: ''
  },
  products: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    quantity: Number,
  }],
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'processed', 'completed', 'customer_replied'],
  },
  communications: [{
    type: { 
      type: String, 
      enum: ['outbound', 'inbound', 'internal_note'],
      required: true 
    },
    content: String,
    metadata: {
      subject: String,
      from: String,
      to: [String],
      date: Date,
      messageId: String
    }
  }],
  emailThreadId: String
}, {
  timestamps: true,
});

const Quote = mongoose.model('Quote', quoteSchema);

export default Quote;