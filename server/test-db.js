require('dotenv').config();
const mongoose = require('mongoose');

console.log('Connecting to MongoDB...');
console.log('Connection string:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB Connected Successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  }); 