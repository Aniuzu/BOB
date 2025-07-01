const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    console.log('MongoDB Connected');
    
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected. Reconnecting...');
      setTimeout(connectDB, 5000);
    });
    
  } catch (err) {
    console.error('Initial MongoDB connection failed:', err);
    process.exit(1);
  }
};

module.exports = connectDB;