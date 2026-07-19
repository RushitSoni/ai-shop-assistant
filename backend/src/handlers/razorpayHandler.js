const crypto = require('crypto');
const supabase = require('../services/supabase');
const { sendWhatsAppAlert } = require('../services/twilio');

async function handleRazorpayWebhook(req, res) {
  res.sendStatus(200);

  try {
    const signature = req.headers['x-razorpay-signature'];
    
    // req.body is raw Buffer now
    const rawBody = req.body;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('❌ Invalid Razorpay signature');
      return;
    }

    const event = JSON.parse(rawBody.toString());
    console.log('💳 Razorpay event:', event.event);

    if (event.event === 'payment_link.paid') {
      const notes = event.payload.payment_link.entity.notes;
      const shopId = notes.shop_id;
      const phone = notes.phone;

      const subEnd = new Date();
      subEnd.setDate(subEnd.getDate() + 30);

      await supabase
        .from('shops')
        .update({
          is_active: true,
          subscription_ends_at: subEnd.toISOString()
        })
        .eq('id', shopId);

      console.log(`✅ Subscription activated for shop ${shopId} until ${subEnd}`);

      await sendWhatsAppAlert(phone,
        `🎉 *Payment successful!*\n\n` +
        `WhatsApp Shop subscription active ho gaya!\n` +
        `Valid until: ${subEnd.toLocaleDateString('en-IN')}\n\n` +
        `✅ Stock management\n` +
        `✅ Order tracking\n` +
        `✅ Customer ledger\n` +
        `✅ Daily reports\n\n` +
        `Dhanyavaad! 🙏`
      );
    }
  } catch (err) {
    console.error('❌ Razorpay webhook error:', err.message);
  }
}

module.exports = { handleRazorpayWebhook };