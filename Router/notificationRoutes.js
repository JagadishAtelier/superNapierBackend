const express = require("express");
const   router = express.Router();
const webpush = require("../services/notifications");
const Subscription = require("../Model/Subscription");
const NotificationHistory = require("../Model/NotificationHistory");

// ✅ Subscribe
router.post("/subscribe", async (req, res) => {
  try {
    const { endpoint, keys, userId } = req.body;

    await Subscription.findOneAndUpdate(
      { endpoint },
      { endpoint, keys, user: userId },   // <-- add user here
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log("userid :", userId);

    res.status(201).json({ message: "Subscribed!" });
  } catch (err) {
    console.error("Subscription error:", err);
    res.status(500).json({ error: "Failed to subscribe" });
  }
});


// ✅ Send Notification (and save to history)
router.post("/send", async (req, res) => {
  const { title, body } = req.body;

  try {
    // Save to history first
    const notification = await NotificationHistory.create({ title, body });

    // Include notificationId in payload
    const payload = JSON.stringify({
      title,
      body,
      notificationId: notification._id,
    });

    const subscriptions = await Subscription.find({});

    await Promise.all(
      subscriptions.map((sub) =>
        webpush.sendNotification(sub, payload).catch(async (err) => {
          console.error("Push error:", err);
          if (err.statusCode === 410 || err.statusCode === 404) {
            await Subscription.deleteOne({ endpoint: sub.endpoint });
            console.log("Removed invalid subscription:", sub.endpoint);
          }
        })
      )
    );

    res.status(200).json({ message: "Notifications sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send notifications" });
  }
});


// ✅ Get Notification History
router.get("/history", async (req, res) => {
  try {
    const history = await NotificationHistory.find().sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// ✅ Resend Notification by ID
router.post("/resend/:id", async (req, res) => {
  try {
    const notification = await NotificationHistory.findById(req.params.id);
    if (!notification) return res.status(404).json({ error: "Not found" });

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      notificationId: notification._id,
    });

    const subscriptions = await Subscription.find({});
    console.log("📦 Resending to", subscriptions.length, "subscribers");

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, payload);
          console.log("✅ resent to:", sub.endpoint);
        } catch (err) {
          console.log("⚠️ Resend push error for", sub.endpoint, ":", err.message);
          // DO NOT DELETE HERE 👇
        }
      })
    );

    res.json({ message: "Notification resent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to resend notification" });
  }
});


// GET /notifications/stats
router.get("/stats", async (req, res) => {
  try {
    const totalSubscribers = await Subscription.countDocuments();
    const visitedViaPush = await NotificationHistory.aggregate([
      { $match: { visitedViaPush: { $exists: true } } },
      { $group: { _id: null, total: { $sum: "$visitedViaPush" } } },
    ]);

    res.json({
      totalSubscribers,
      visitedViaPush: visitedViaPush[0]?.total || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.post("/track/:id", async (req, res) => {
  try {
    await NotificationHistory.findByIdAndUpdate(req.params.id, {
      $inc: { visitedViaPush: 1 },
    });
    res.json({ message: "Visit tracked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to track visit" });
  }
});

module.exports = router;
