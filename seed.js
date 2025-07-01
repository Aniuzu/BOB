import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';

dotenv.config();

const products = [
  {
    name: 'Premium Cement',
    category: 'cement',
    description: 'High quality construction cement for all your building needs',
    image: 'images/Cement.webp',
    price: 12.99,
    features: ['50kg bags', 'Fast setting', 'High durability']
  },
  {
    name: 'Quality Gravel',
    category: 'gravel',
    description: 'Washed and graded gravel for construction',
    image: 'images/Gravel.webp',
    price: 8.50,
    features: ['20mm size', 'Clean washed', 'Excellent drainage']
  },
  {
    name: 'Fine Sand',
    category: 'sand',
    description: 'Fine construction sand for masonry work',
    image: 'images/Sand.webp',
    price: 6.75,
    features: ['River sand', 'Well graded', 'No impurities']
  },
  {
    name: 'Solid Concrete Block',
    category: 'concrete-blocks',
    description: 'Durable concrete blocks for construction',
    image: 'images/SolidBlock.webp',
    price: 2.25,
    features: ['9x18x36 cm', 'High strength', 'Weather resistant']
  }
];

const seedDB = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Database connected!');
    
    console.log('Clearing existing products...');
    await Product.deleteMany();
    
    console.log('Inserting new products...');
    await Product.insertMany(products);
    
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDB();