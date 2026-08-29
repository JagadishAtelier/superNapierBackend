const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load .env
dotenv.config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;

async function run() {
    console.log("Connecting to MONGO_URI...");
    await mongoose.connect(MONGO_URI);
    
    // Find admins
    const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
    const admins = await User.find({ role: "admin" }).limit(10);
    console.log("Admins found:");
    admins.forEach(admin => {
        console.log(`- Email: ${admin.get("email")}, Name: ${admin.get("name")}`);
    });
    
    await mongoose.disconnect();
}

run().catch(console.error);
