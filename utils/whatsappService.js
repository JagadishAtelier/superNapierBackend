const axios = require('axios');

/**
 * WhatsApp Service using Meta Cloud API
 */
class WhatsappService {
  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || 'DUMMY_ACCESS_TOKEN';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || 'DUMMY_PHONE_NUMBER_ID';
    this.apiUrl = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;
  }

  /**
   * Send a template message
   * @param {string} to - Recipient phone number (with country code, no +)
   * @param {string} templateName - Template name approved in Meta Business Suite
   * @param {Array} parameters - Array of parameter objects for the template
   */
  async sendTemplate(to, templateName, parameters = []) {
    try {
      if (this.accessToken === 'DUMMY_ACCESS_TOKEN') {
        console.log(`[WhatsApp Dummy] Sending template "${templateName}" to ${to} with params:`, parameters);
        return { success: true, message: 'Dummy message logged' };
      }

      const response = await axios.post(
        this.apiUrl,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en_US' },
            components: [
              {
                type: 'body',
                parameters: parameters.map(p => ({ type: 'text', text: String(p) })),
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return { success: true, data: response.data };
    } catch (error) {
      console.error('WhatsApp Service Error:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }

  /**
   * Send OTP via WhatsApp
   * @param {string} to - Recipient phone number
   * @param {string} otp - 6 digit OTP
   */
  async sendOTP(to, otp) {
    const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'otp_template';
    return this.sendTemplate(to, templateName, [otp]);
  }

  /**
   * Send Order Notification
   * @param {string} to - Recipient phone number
   * @param {Object} orderDetails - { id, total, status }
   */
  async sendOrderNotification(to, orderDetails) {
    const templateName = process.env.WHATSAPP_ORDER_CONFIRMATION_TEMPLATE_NAME || 'order_confirmation';
    // Example params: Order ID, Amount
    return this.sendTemplate(to, templateName, [orderDetails.id, orderDetails.total]);
  }
}

module.exports = new WhatsappService();
