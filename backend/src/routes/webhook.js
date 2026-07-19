const express = require('express');
const router = express.Router();
const { handleTwilioMessage } = require('../handlers/twilioHandler');
const { handleRazorpayWebhook } = require('../handlers/razorpayHandler');
const { sendOTP, verifyOTP } = require('../handlers/otpHandler');

// Twilio webhook
router.post('/twilio', handleTwilioMessage);

// Razorpay webhook - needs raw body for signature verification
router.post('/razorpay', 
  express.raw({ type: '*/*' }), 
  handleRazorpayWebhook
);

// Razorpay redirect after payment
router.get('/razorpay', (req, res) => {
  res.send('✅ Payment successful! WhatsApp par confirmation check karo.');
});


router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

module.exports = router;