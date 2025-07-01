import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['concrete-blocks', 'sand', 'cement', 'gravel', 'solid-block'],
  },
  description: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  features: [String],
}, {
  timestamps: true,
});

const Product = mongoose.model('Product', productSchema);

export default Product;