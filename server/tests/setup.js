// Polyfill SlowBuffer for legacy dependencies on modern Node runtimes
const _buffer = require('buffer');
if (typeof global.SlowBuffer === 'undefined') {
  global.SlowBuffer = _buffer.SlowBuffer || _buffer.Buffer;
}
if (global.SlowBuffer && !global.SlowBuffer.prototype) {
  global.SlowBuffer.prototype = _buffer.Buffer.prototype;
}

require('dotenv').config();
const mongoose = require('mongoose');

const TEST_DB_URI = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/finsight_test';

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_DB_URI, {
      serverSelectionTimeoutMS: 5000
    });
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    // Drop test database to keep test environment clean
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.connection.close();
  }
});
