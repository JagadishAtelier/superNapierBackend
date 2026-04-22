const GlobalSettings = require("../Model/GlobalSettings");

exports.getSettings = async (req, res) => {
  try {
    let settings = await GlobalSettings.findOne({ settingsId: "site_settings" });
    if (!settings) {
      settings = await GlobalSettings.create({ settingsId: "site_settings" });
    }
    res.status(200).json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const settings = await GlobalSettings.findOneAndUpdate(
      { settingsId: "site_settings" },
      { $set: req.body },
      { new: true, upsert: true }
    );
    res.status(200).json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
