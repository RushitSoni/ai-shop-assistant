const supabase = require('../services/supabase');
const { createPaymentLink } = require('../services/razorpay');
const { sendWhatsAppAlert } = require('../services/twilio');

async function checkSubscription(shop, phone) {
  const now = new Date();
  const trialEnd = new Date(shop.trial_ends_at);
  const subEnd = shop.subscription_ends_at ? new Date(shop.subscription_ends_at) : null;

  // Active subscription
  if (subEnd && subEnd > now) return { active: true };

  // Active trial
  if (trialEnd > now) {
    const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
    
    // Warn when 2 days left
    if (daysLeft <= 2) {
      const link = await createPaymentLink(shop, phone);
      await sendWhatsAppAlert(phone,
        `⏰ *Trial khatam hone wala hai!*\n\n` +
        `Sirf *${daysLeft} din* bacha hai.\n\n` +
        `Subscription renew karo sirf *₹299/month* mein:\n${link}\n\n` +
        `Band hone par ye features band ho jayenge:\n` +
        `❌ Stock management\n❌ Order tracking\n❌ Ledger\n❌ Daily reports`
      );
    }
    return { active: true };
  }

  // Expired — send payment link
  const link = await createPaymentLink(shop, phone);
  return { 
    active: false, 
    message: `😔 *Aapka trial khatam ho gaya!*\n\n` +
      `WhatsApp Shop use karte rehne ke liye subscribe karo:\n\n` +
      `💰 *Sirf ₹299/month*\n` +
      `✅ Unlimited stock management\n` +
      `✅ Order tracking\n` +
      `✅ Customer ledger\n` +
      `✅ Daily reports\n` +
      `✅ Low stock alerts\n\n` +
      `👉 Payment karo: ${link}`
  };
}

module.exports = { checkSubscription };