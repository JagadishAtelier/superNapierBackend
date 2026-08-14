require('dotenv').config();
const axios = require('axios');
const Otp = require('../Model/OtpModel');

const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY;
const OTP_TTL = parseInt(process.env.OTP_TTL_SECONDS || '300', 10); // 5 mins
const MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);

if (!FAST2SMS_KEY) console.warn('⚠️ FAST2SMS_API_KEY not set in .env');

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP using official Fast2SMS API
async function sendSmsFast2Sms(phone, otp) {
  const payload = {
    route: 'otp',
    variables_values: otp, // OTP value
    numbers: phone, // e.g. 919876543210
  };

  const headers = {
    authorization: FAST2SMS_KEY,
    'Content-Type': 'application/json',
  };

  console.log("📤 Sending Fast2SMS OTP Request:", payload);

  const response = await axios.post(
    'https://www.fast2sms.com/dev/bulkV2',
    payload,
    { headers, timeout: 10000 }
  );

  console.log("✅ Fast2SMS Response:", response.data);
  return response.data;
}

// Send OTP endpoint
exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone number is required' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_TTL * 1000);

    // Clean up previous OTPs for this phone
    await Otp.deleteMany({ phone });

    // Store OTP in database
    const otpRecord = new Otp({
      phone,
      otp,
      expiresAt,
      attempts: 0
    });
    await otpRecord.save();

    console.log(`💬 Sending OTP ${otp} to ${phone}`);

    const result = await sendSmsFast2Sms(phone, otp);

    if (result && result.return === true) {
      return res.status(200).json({ success: true, message: 'OTP sent successfully' });
    } else {
      console.warn('⚠️ Invalid Fast2SMS Response:', result);
      return res.status(502).json({ success: false, error: 'Fast2SMS failed', details: result });
    }
  } catch (err) {
    console.error('❌ sendOtp error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, error: 'Failed to send OTP', details: err.message });
  }
};

// Verify OTP endpoint
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ success: false, error: 'Phone and OTP are required' });

    const entry = await Otp.findOne({ phone });
    if (!entry) return res.status(400).json({ success: false, error: 'No OTP requested or expired' });

    if (new Date() > entry.expiresAt) {
      await Otp.deleteOne({ _id: entry._id });
      return res.status(400).json({ success: false, error: 'OTP expired' });
    }

    entry.attempts++;
    await entry.save();

    if (entry.attempts > MAX_ATTEMPTS) {
      await Otp.deleteOne({ _id: entry._id });
      return res.status(429).json({ success: false, error: 'Too many attempts' });
    }

    if (entry.otp === otp.toString().trim()) {
      await Otp.deleteOne({ _id: entry._id });
      return res.status(200).json({ success: true, message: 'OTP verified successfully' });
    } else {
      const triesLeft = MAX_ATTEMPTS - entry.attempts;
      return res.status(400).json({ success: false, error: 'Invalid OTP', triesLeft });
    }
  } catch (err) {
    console.error('❌ verifyOtp error:', err.message);
    return res.status(500).json({ success: false, error: 'Verification failed', details: err.message });
  }
};
