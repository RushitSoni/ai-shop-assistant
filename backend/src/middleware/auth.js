const supabase = require('../services/supabase');

async function authMiddleware(phone) {
  try {
    // Check if user exists
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('*, shops(*)')
      .eq('phone', phone)
      .single();

    if (!user) {
      console.log(`🆕 New user ${phone} — registering...`);

      // Step 1: Create shop
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .insert({ 
          owner_phone: phone, 
          shop_name: 'My Shop', 
          is_active: true 
        })
        .select();

      if (shopError) {
        console.error('Shop insert error:', shopError.message);
        return null;
      }

      console.log('Shop created:', shop[0].id);

      // Step 2: Create user
      const { data: newUser, error: newUserError } = await supabase
        .from('users')
        .insert({ 
          phone, 
          shop_id: shop[0].id, 
          role: 'owner' 
        })
        .select('*, shops(*)');

      if (newUserError) {
        console.error('User insert error:', newUserError.message);
        return null;
      }

      console.log(`✅ New shop registered for ${phone}`);
      return { user: newUser[0], shop: shop[0], isNew: true };
    }

    console.log(`✅ User found: ${phone}`);
    return { user, shop: user.shops, isNew: false };

  } catch (err) {
    console.error('❌ Auth error:', err.message);
    return null;
  }
}

module.exports = authMiddleware;