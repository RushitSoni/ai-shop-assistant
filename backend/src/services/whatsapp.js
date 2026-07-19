const axios = require('axios');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v19.0';

/**
 * Send a text message to a WhatsApp number.
 * @param {string} to - Recipient phone number (with country code, no +)
 * @param {string} text - Message text
 */
async function sendWhatsAppMessage(to, text) {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const token = process.env.META_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    throw new Error('META_PHONE_NUMBER_ID or META_ACCESS_TOKEN missing in .env');
  }

  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`📤 Message sent to ${to} — ID: ${response.data.messages?.[0]?.id}`);
    return response.data;
  } catch (err) {
    const errData = err.response?.data;
    console.error('❌ Failed to send WhatsApp message:', errData || err.message);
    throw err;
  }
}

module.exports = { sendWhatsAppMessage };
