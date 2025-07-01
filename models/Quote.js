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
    enum: ['pending', 'processed', 'completed'],
  },
}, {
  timestamps: true,
});

const Quote = mongoose.model('Quote', quoteSchema);

export default Quote;