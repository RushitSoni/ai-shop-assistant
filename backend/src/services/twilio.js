const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendWhatsAppAlert(to, message) {
  try {
    await client.messages.create({
      from: 'whatsapp:+14155238886', // Twilio sandbox number
      to: `whatsapp:${to}`,
      body: message
    });
    console.log(`📲 Alert sent to ${to}`);
  } catch (err) {
    console.error('❌ Alert send failed:', err.message);
  }
}

module.exports = { sendWhatsAppAlert };