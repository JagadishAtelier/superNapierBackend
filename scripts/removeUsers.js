const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const User = require("../Model/User");

const MONGO_URI = process.env.MONGO_URI;

const emailsToDelete = [
  "prasanth.atelier@gmail.com",
  "prasanthoyasco@gmail.com"
];

async function removeUsers() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB.");

    // The user schema has email defined with lowercase: true.
    // Ensure we are querying lowercase.
    const query = { email: { $in: emailsToDelete.map(e => e.toLowerCase()) } };

    const result = await User.deleteMany(query);
    console.log(`Successfully deleted ${result.deletedCount} user(s).`);

  } catch (err) {
    console.error("Error removing users:", err);
  } finally {
    console.log("Disconnecting from MongoDB...");
    await mongoose.disconnect();
    process.exit(0);
  }
}

removeUsers();
