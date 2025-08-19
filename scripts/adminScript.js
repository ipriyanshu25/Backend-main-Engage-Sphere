const mongoose = require('mongoose');
require('dotenv').config();
const Admin = require('../model/admin');

async function createDefaultAdmin() {
  try {
    // connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // delete all existing admin documents
    const deleteResult = await Admin.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing admin(s)`);

    // create new default admin
    const admin = new Admin({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    });
    await admin.save();
    console.log('Default admin created:', admin.email);

    process.exit(0);
  } catch (error) {
    console.error('Error creating default admin:', error);
    process.exit(1);
  }
}

createDefaultAdmin();
