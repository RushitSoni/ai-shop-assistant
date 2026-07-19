const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

async function createPaymentLink(shop, phone) {
  const paymentLink = await razorpay.paymentLink.create({
    amount: 29900, // ₹299 in paise
    currency: 'INR',
    description: 'WhatsApp Shop - Monthly Subscription',
    customer: {
      contact: phone
    },
    notify: {
      sms: true,
      email: false
    },
    reminder_enable: true,
    notes: {
      shop_id: shop.id,
      phone: phone
    },
    callback_url: `${process.env.SERVER_URL}/razorpay-webhook`,
    callback_method: 'get'
  });

  return paymentLink.short_url;
}

module.exports = { razorpay, createPaymentLink };