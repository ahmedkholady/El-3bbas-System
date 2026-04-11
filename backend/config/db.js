const mongoose = require('mongoose');

const connectDB = async () => {
  // First try the configured MONGO_URI (Atlas)
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return;
  } catch (error) {
    console.warn(`Atlas connection failed: ${error.message}`);
    console.warn('Falling back to in-memory MongoDB server...');
  }

  // Fallback: use mongodb-memory-server for local development
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create({
      instance: {
        launchTimeout: 30000,
      },
    });
    const uri = mongod.getUri();
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB In-Memory Connected: ${conn.connection.host}`);
    console.warn('⚠️  Using in-memory database — data will NOT persist after server restart!');

    // Store reference so it can be cleaned up
    process.on('SIGINT', async () => {
      await mongoose.disconnect();
      await mongod.stop();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await mongoose.disconnect();
      await mongod.stop();
      process.exit(0);
    });
  } catch (fallbackError) {
    console.error(`All MongoDB connections failed: ${fallbackError.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
