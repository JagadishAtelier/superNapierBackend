// utils/sendEmail.js
const axios = require('axios');
require('dotenv').config();

const sendEmail = async (to, subject, htmlContent, textContent) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.error("❌ RESEND_API_KEY is not defined in .env");
    throw new Error("Email sending failed: RESEND_API_KEY is missing");
  }

  // If a custom verified domain is not set, default to Resend's default test sender
  const fromEmail = process.env.RESEND_FROM || process.env.EMAIL_USER || "onboarding@resend.dev";
  const fromName = process.env.RESEND_FROM_NAME || "SuperNapier";

  const payload = {
    from: `"${fromName}" <${fromEmail}>`,
    to: Array.isArray(to) ? to : [to],
    subject: subject,
    html: htmlContent,
    text: textContent
  };

  console.log("📨 Sending email via Resend to:", to);
  console.log("📝 Subject:", subject);

  try {
    const response = await axios.post(
      'https://api.resend.com/emails',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log("✅ Resend response:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Resend Email sending failed!");
    if (error.response && error.response.data) {
      console.error("Resend API Error details:", error.response.data);
      throw new Error(`Resend sending failed: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error("Error details:", error.message);
      throw new Error(`Resend sending failed: ${error.message}`);
    }
  }
};

module.exports = sendEmail;
