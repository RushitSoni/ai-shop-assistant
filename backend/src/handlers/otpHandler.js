const supabase = require('../services/supabase');
const { sendWhatsAppAlert } = require('../services/twilio');

async function sendOTP(req, res) {
  const { phone } = req.body;

  if (!phone) return res.status(400).json({ error: 'Phone required' });

  // Format phone
  let formattedPhone = phone.trim();
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+91' + formattedPhone;
  }

  // Check if user exists
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('phone', formattedPhone)
    .single();

  if (!user) {
    return res.status(404).json({ error: 'Phone not registered. Please message the WhatsApp bot first!' });
  }

  // Generate 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Save OTP
  await supabase.from('otp_codes').insert({
    phone: formattedPhone,
    code,
    expires_at: expiresAt.toISOString()
  });

  // Send via WhatsApp
  await sendWhatsAppAlert(
    formattedPhone,
    `🔐 *WhatsApp Shop Dashboard*\n\nYour OTP is: *${code}*\n\nValid for 5 minutes. Do not share with anyone.`
  );

  console.log(`📲 OTP sent to ${formattedPhone}: ${code}`);
  res.json({ success: true, message: 'OTP sent on WhatsApp!' });
}

async function verifyOTP(req, res) {
  const { phone, code } = req.body;

  if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' });

  let formattedPhone = phone.trim();
  if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+91' + formattedPhone;
  }

  // Find valid OTP
  const { data: otp } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('phone', formattedPhone)
    .eq('code', code)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!otp) {
    return res.status(400).json({ error: 'Invalid or expired OTP. Try again!' });
  }

  // Mark OTP as used
  await supabase.from('otp_codes').update({ used: true }).eq('id', otp.id);

  // Get user + shop
  const { data: user } = await supabase
    .from('users')
    .select('*, shops(*)')
    .eq('phone', formattedPhone)
    .single();

  res.json({ success: true, shop: { ...user.shops, userPhone: formattedPhone } });
}

module.exports = { sendOTP, verifyOTP };