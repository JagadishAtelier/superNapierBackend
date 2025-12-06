// server.js
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const app = require("./app"); // your Express app
require("dotenv").config();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// 1️⃣ Create HTTP server from Express app
const server = http.createServer(app);

// 2️⃣ Attach Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.UI_ORIGIN || "*", // restrict in prod
    methods: ["GET", "POST"],
  },
});

// Attach io to app.locals so controllers can use req.app.locals.io
app.locals.io = io;

// 3️⃣ Socket.IO connection
io.on("connection", (socket) => {
  console.log("⚡ Socket connected:", socket.id);

  // Pilot joins rooms: broadcasts to pilot group + a dedicated pilot room
  socket.on("joinPilots", (pilotId) => {
    try {
      socket.join("pilots");
      if (pilotId) socket.join(`pilot_${pilotId}`);
      console.log(`👨‍✈️ Pilot ${pilotId || "(unknown)"} joined rooms`);
    } catch (err) {
      console.error("joinPilots error:", err);
    }
  });

  // Admins can join an admins room
  socket.on("joinAdmins", () => {
    socket.join("admins");
    console.log("🔒 Admin joined admins room");
  });

  // Socket-based claim flow (atomic)
  socket.on("claimOrder", async ({ orderId, pilotId }) => {
    try {
      const Order = require("./Model/Order"); // keep your current path
      const ObjectId = mongoose.Types.ObjectId;

      if (!orderId || !pilotId) {
        return socket.emit("claimResponse", { success: false, message: "orderId and pilotId required" });
      }

      // Build atomic query: available if unclaimed OR previous claim expired
      const now = new Date();
      const claimDurationMs = 2 * 60 * 1000; // 2 minutes
      const claimExpiresAt = new Date(now.getTime() + claimDurationMs);

      const query = {
        _id: ObjectId.isValid(orderId) ? ObjectId(orderId) : orderId,
        $or: [
          { claimedBy: null },
          { claimExpiresAt: { $lte: new Date() } },
          { claimExpiresAt: null },
        ],
        status: "pending", // match schema's machine-friendly status
      };

      const update = {
        $set: {
          claimedBy: ObjectId.isValid(pilotId) ? ObjectId(pilotId) : pilotId,
          claimedAt: now,
          claimExpiresAt,
          status: "claimed",
        },
      };

      const claimed = await Order.findOneAndUpdate(query, update, { new: true })
        .populate("buyer", "name email")
        .populate("products.productId", "name price")
        .exec();

      if (!claimed) {
        return socket.emit("claimResponse", { success: false, message: "Already claimed or unavailable" });
      }

      // Notify the claiming pilot (dedicated room)
      io.to(`pilot_${pilotId}`).emit("orderAssigned", { order: claimed });

      // Notify all pilots that the order is no longer available
      io.to("pilots").emit("orderClaimed", {
        orderId: claimed._id,
        claimedBy: claimed.claimedBy,
        claimedAt: claimed.claimedAt,
      });

      // Notify admins too
      io.to("admins").emit("orderClaimed", {
        orderId: claimed._id,
        claimedBy: claimed.claimedBy,
        claimedAt: claimed.claimedAt,
      });

      // Finally confirm to the socket that claimed was successful
      socket.emit("claimResponse", { success: true, order: claimed });
    } catch (err) {
      console.error("Socket claimOrder error:", err);
      socket.emit("claimResponse", { success: false, message: "Server error" });
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// Auto-release expired claims every 30 seconds
setInterval(async () => {
  try {
    const Order = require("./Model/Order");
    const now = new Date();
    const res = await Order.updateMany(
      { claimedBy: { $ne: null }, claimExpiresAt: { $lte: now } },
      { $set: { claimedBy: null, claimedAt: null, claimExpiresAt: null, status: "pending" } }
    );

    if (res.modifiedCount && res.modifiedCount > 0) {
      console.log(`🔁 Released ${res.modifiedCount} expired claims`);
      io.to("pilots").emit("orderReleased");
      io.to("admins").emit("orderReleased");
    }
  } catch (err) {
    console.error("Auto-release error:", err);
  }
}, 30 * 1000);

// 4️⃣ Connect DB + start server
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  });

module.exports = io;
