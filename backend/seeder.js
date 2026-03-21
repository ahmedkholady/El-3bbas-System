const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Product = require('./models/Product');
const Sale = require('./models/Sale');
const connectDB = require('./config/db');

dotenv.config();

connectDB();

const importData = async () => {
  try {
    await Sale.deleteMany();
    await Product.deleteMany();
    await User.deleteMany();

    const createdUser = await User.create({
      name: 'Admin User',
      username: 'admin',
      password: 'password123',
      role: 'admin',
    });

    console.log('Data Imported - Admin User created:');
    console.log(`Username: ${createdUser.username}`);
    console.log(`Password: password123`);
    process.exit();
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await Sale.deleteMany();
    await Product.deleteMany();
    await User.deleteMany();

    console.log('Data Destroyed!');
    process.exit();
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}
