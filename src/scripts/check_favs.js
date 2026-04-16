const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const User = require('../models/User');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const u = await User.find();
  console.log('Total users:', u.length);
  mongoose.disconnect();
}
test();
