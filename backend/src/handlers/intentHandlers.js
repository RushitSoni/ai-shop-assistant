const supabase = require('../services/supabase');
const { getEmbedding } = require('../services/embeddings');
const { sendWhatsAppAlert } = require('../services/twilio');

async function handleAddStock(entities, shopId) {
  const { product, quantity, unit, price } = entities;

  if (!product || !quantity) {
    return '❌ Product ya quantity samajh nahi aaya.\nExample: "20 Maggi aaye"';
  }

  const { data: existing } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .ilike('name', `%${product}%`)
    .single();

  if (existing) {
    const newQty = Number(existing.quantity) + Number(quantity);
    const updateData = { quantity: newQty, updated_at: new Date() };
    if (price) updateData.price = Number(price);

    await supabase.from('products').update(updateData).eq('id', existing.id);

    if (newQty <= existing.low_threshold) {
      await sendWhatsAppAlert(
        process.env.OWNER_PHONE,
        `⚠️ *Low Stock Alert!*\n\n📦 ${existing.name} ka stock kam ho gaya!\nCurrent: ${newQty} ${existing.unit}\nThreshold: ${existing.low_threshold} ${existing.unit}\n\nJaldi reorder karo!`
      );
    }

    const lowAlert = newQty <= existing.low_threshold ? '\n⚠️ Alert bheja gaya!' : '';
    const priceMsg = price ? `\n💰 Price: ₹${price}` : '';
    return `✅ Stock updated!\n📦 ${existing.name}\nPehle: ${existing.quantity} ${existing.unit}\nAb: ${newQty} ${existing.unit}${priceMsg}${lowAlert}`;
  } else {
    const embedding = await getEmbedding(product);
    await supabase.from('products').insert({
      shop_id: shopId,
      name: product,
      quantity: Number(quantity),
      unit: unit || 'units',
      price: price ? Number(price) : 0,
      embedding
    });
    const priceMsg = price ? ` @ ₹${price} each` : '';
    return `✅ Naya product add ho gaya!\n📦 ${product}: ${quantity} ${unit || 'units'}${priceMsg}`;
  }
}

async function handleCheckStock(entities, shopId) {
  const { product } = entities;

  if (!product) {
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .order('name');

    if (!products || products.length === 0) {
      return '📦 Abhi koi product stock mein nahi hai.';
    }

    let reply = '📦 *Poora Stock:*\n\n';
    products.forEach(p => {
      const low = p.quantity <= p.low_threshold ? ' ⚠️' : '';
      reply += `• ${p.name}: *${p.quantity} ${p.unit}* @ ₹${p.price || '?'}${low}\n`;
    });
    return reply;
  }

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .ilike('name', `%${product}%`);

  if (!products || products.length === 0) {
    return `❌ "${product}" stock mein nahi mila.`;
  }

  const p = products[0];
  const low = p.quantity <= p.low_threshold ? '\n⚠️ Stock kam hai! Jaldi order karo.' : '';
  return `📦 *${p.name}*\nQuantity: ${p.quantity} ${p.unit}\n💰 Price: ₹${p.price || 'Not set'}${low}`;
}

async function handleUpdatePrice(entities, shopId) {
  const { product, price } = entities;

  if (!product || !price) {
    return '❌ Product ya price samajh nahi aaya.\nExample: "Maggi ka price 15 kar do"';
  }

  const { data: existing } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .ilike('name', `%${product}%`)
    .single();

  if (!existing) {
    return `❌ "${product}" stock mein nahi mila.`;
  }

  await supabase
    .from('products')
    .update({ price: Number(price), updated_at: new Date() })
    .eq('id', existing.id);

  return `✅ Price updated!\n📦 ${existing.name}\nPehle: ₹${existing.price || '?'}\nAb: ₹${price}`;
}

async function handleSetThreshold(entities, shopId) {
  const { product, threshold } = entities;

  if (!product || !threshold) {
    return '❌ Product ya threshold samajh nahi aaya.\nExample: "Maggi ka minimum 10 rakho"';
  }

  const { data: existing } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .ilike('name', `%${product}%`)
    .single();

  if (!existing) {
    return `❌ "${product}" stock mein nahi mila.`;
  }

  await supabase
    .from('products')
    .update({ low_threshold: Number(threshold), updated_at: new Date() })
    .eq('id', existing.id);

  return `✅ Threshold set!\n📦 ${existing.name}\nMinimum stock: ${threshold} ${existing.unit}\nAlert tab aayega jab stock ${threshold} se kam ho.`;
}

async function handleDeleteProduct(entities, shopId) {
  const { product } = entities;

  if (!product) {
    return '❌ Product naam samajh nahi aaya.';
  }

  const { data: existing } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .ilike('name', `%${product}%`)
    .single();

  if (!existing) {
    return `❌ "${product}" stock mein nahi mila.`;
  }

  await supabase.from('products').delete().eq('id', existing.id);

  return `✅ ${existing.name} stock se hata diya gaya.\nQuantity thi: ${existing.quantity} ${existing.unit}`;
}

async function handleAddOrder(entities, shopId) {
  const { product, quantity, customer } = entities;

  if (!product) {
    return '❌ Order mein product samajh nahi aaya.\nExample: "Ram ke liye 2 Maggi ka order"';
  }

  const { data: stockItem } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .ilike('name', `%${product}%`)
    .single();

  if (!stockItem) {
    return `❌ "${product}" stock mein nahi hai. Pehle stock add karo.`;
  }

  const orderQty = Number(quantity) || 1;
  if (stockItem.quantity < orderQty) {
    return `❌ Stock kam hai!\n${product} sirf ${stockItem.quantity} ${stockItem.unit} bacha hai.`;
  }

  const itemTotal = (stockItem.price || 0) * orderQty;
  const items = [{
    name: stockItem.name,
    qty: orderQty,
    unit: stockItem.unit,
    price: stockItem.price || 0
  }];

  const { data: order } = await supabase
    .from('orders')
    .insert({
      shop_id: shopId,
      customer_name: customer || 'Walk-in',
      items_json: items,
      total_amount: itemTotal,
      status: 'delivered'
    })
    .select()
    .single();

  const newQty = stockItem.quantity - orderQty;
  await supabase
    .from('products')
    .update({ quantity: newQty, updated_at: new Date() })
    .eq('id', stockItem.id);

  if (newQty <= stockItem.low_threshold) {
    await sendWhatsAppAlert(
      process.env.OWNER_PHONE,
      `⚠️ *Low Stock Alert!*\n\n📦 ${stockItem.name} ka stock kam ho gaya!\nCurrent: ${newQty} ${stockItem.unit}\nThreshold: ${stockItem.low_threshold} ${stockItem.unit}\n\nJaldi reorder karo!`
    );
    console.log(`⚠️ Low stock alert sent for ${stockItem.name}`);
  }

  const orderId = order.id.slice(0, 8).toUpperCase();
  const amountMsg = itemTotal > 0 ? `\n💰 Amount: ₹${itemTotal}` : '';
  return `✅ Order placed!\n🧾 Order ID: #${orderId}\n👤 Customer: ${customer || 'Walk-in'}\n📦 ${stockItem.name}: ${orderQty} ${stockItem.unit}${amountMsg}\n📌 Status: Delivered`;
}

async function handleCheckOrder(entities, shopId) {
  const { customer } = entities;

  if (!customer) {
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!orders || orders.length === 0) {
      return '📋 Koi order nahi mila.';
    }

    let reply = '📋 *Recent Orders:*\n\n';
    orders.forEach(o => {
      const orderId = o.id.slice(0, 8).toUpperCase();
      reply += `#${orderId} — ${o.customer_name} — ${o.status}\n`;
    });
    return reply;
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('shop_id', shopId)
    .ilike('customer_name', `%${customer}%`)
    .order('created_at', { ascending: false })
    .limit(3);

  if (!orders || orders.length === 0) {
    return `❌ ${customer} ka koi order nahi mila.`;
  }

  let reply = `📋 *${customer} ke Orders:*\n\n`;
  orders.forEach(o => {
    const orderId = o.id.slice(0, 8).toUpperCase();
    const items = o.items_json.map(i => `${i.qty} ${i.name}`).join(', ');
    reply += `#${orderId}: ${items} — *${o.status}*\n`;
  });
  return reply;
}

async function handleUpdateOrder(entities, shopId) {
  const { customer, status } = entities;

  if (!customer) {
    return '❌ Customer naam samajh nahi aaya.\nExample: "Ram ka order ready hai"';
  }

  const newStatus = status || 'ready';

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('shop_id', shopId)
    .ilike('customer_name', `%${customer}%`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!orders || orders.length === 0) {
    return `❌ ${customer} ka koi order nahi mila.`;
  }

  const order = orders[0];
  await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', order.id);

  const orderId = order.id.slice(0, 8).toUpperCase();
  return `✅ Order updated!\n🧾 #${orderId}\n👤 ${customer}\n📌 Status: ${newStatus}`;
}

async function handleCancelOrder(entities, shopId) {
  const { customer } = entities;

  if (!customer) {
    return '❌ Customer naam samajh nahi aaya.\nExample: "Ram ka order cancel karo"';
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('shop_id', shopId)
    .ilike('customer_name', `%${customer}%`)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!orders || orders.length === 0) {
    return `❌ ${customer} ka koi active order nahi mila.`;
  }

  const order = orders[0];

  // Restore stock
  for (const item of order.items_json) {
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .ilike('name', `%${item.name}%`)
      .single();

    if (product) {
      await supabase
        .from('products')
        .update({ quantity: product.quantity + item.qty, updated_at: new Date() })
        .eq('id', product.id);
    }
  }

  await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);

  const orderId = order.id.slice(0, 8).toUpperCase();
  return `✅ Order cancelled!\n🧾 #${orderId}\n👤 ${customer}\n📦 Stock wapas add ho gaya.`;
}

async function handleAddLedger(entities, shopId) {
  const { customer, amount } = entities;

  if (!customer || !amount) {
    return '❌ Customer naam ya amount samajh nahi aaya.\nExample: "Rahul ka 500 baaki hai"';
  }

  await supabase.from('ledger').insert({
    shop_id: shopId,
    customer_name: customer,
    amount: Number(amount),
    type: 'credit',
    note: 'WhatsApp se add kiya'
  });

  return `✅ Ledger updated!\n📒 ${customer} ka ₹${amount} baaki add ho gaya.`;
}

async function handleAddPayment(entities, shopId) {
  const { customer, amount } = entities;

  if (!customer || !amount) {
    return '❌ Customer naam ya amount samajh nahi aaya.\nExample: "Rahul ne 200 diya"';
  }

  await supabase.from('ledger').insert({
    shop_id: shopId,
    customer_name: customer,
    amount: Number(amount),
    type: 'payment',
    note: 'WhatsApp se payment record kiya'
  });

  const { data: ledger } = await supabase
    .from('ledger')
    .select('*')
    .eq('shop_id', shopId)
    .ilike('customer_name', `%${customer}%`);

  const balance = ledger.reduce((sum, l) => {
    return l.type === 'credit' ? sum + Number(l.amount) : sum - Number(l.amount);
  }, 0);

  const balanceMsg = balance > 0
    ? `\nAbhi bhi ₹${balance} baaki hai.`
    : '\n✅ Hisaab saaf ho gaya!';
  return `✅ Payment recorded!\n💰 ${customer} ne ₹${amount} diya.${balanceMsg}`;
}

async function handleCheckLedger(entities, shopId) {
  const { customer } = entities;

  if (!customer) {
    const { data: ledger } = await supabase
      .from('ledger')
      .select('*')
      .eq('shop_id', shopId)
      .order('customer_name');

    if (!ledger || ledger.length === 0) {
      return '📒 Kisi ka baaki nahi hai.';
    }

    const balances = {};
    ledger.forEach(l => {
      if (!balances[l.customer_name]) balances[l.customer_name] = 0;
      balances[l.customer_name] += l.type === 'credit' ? Number(l.amount) : -Number(l.amount);
    });

    let reply = '📒 *Baaki List:*\n\n';
    Object.entries(balances)
      .filter(([_, bal]) => bal > 0)
      .sort(([_, a], [__, b]) => b - a)
      .forEach(([name, bal]) => {
        reply += `• ${name}: ₹${bal}\n`;
      });
    return reply || '✅ Sabka hisaab saaf hai!';
  }

  const { data: ledger } = await supabase
    .from('ledger')
    .select('*')
    .eq('shop_id', shopId)
    .ilike('customer_name', `%${customer}%`)
    .order('created_at', { ascending: false });

  if (!ledger || ledger.length === 0) {
    return `❌ ${customer} ka koi record nahi mila.`;
  }

  const balance = ledger.reduce((sum, l) => {
    return l.type === 'credit' ? sum + Number(l.amount) : sum - Number(l.amount);
  }, 0);

  let reply = `📒 *${customer} ka Hisaab:*\n\n`;
  ledger.slice(0, 5).forEach(l => {
    const sign = l.type === 'credit' ? '+' : '-';
    reply += `${sign}₹${l.amount} (${l.type})\n`;
  });
  reply += `\n*Total baaki: ₹${balance}*`;
  return reply;
}

async function handleDeleteLedger(entities, shopId) {
  const { customer } = entities;

  if (!customer) {
    return '❌ Customer naam samajh nahi aaya.\nExample: "Rahul ka hisaab clear karo"';
  }

  const { data: existing } = await supabase
    .from('ledger')
    .select('*')
    .eq('shop_id', shopId)
    .ilike('customer_name', `%${customer}%`);

  if (!existing || existing.length === 0) {
    return `❌ ${customer} ka koi record nahi mila.`;
  }

  await supabase
    .from('ledger')
    .delete()
    .eq('shop_id', shopId)
    .ilike('customer_name', `%${customer}%`);

  return `✅ ${customer} ka poora hisaab clear ho gaya!\n🗑️ ${existing.length} records delete kiye gaye.`;
}

async function handleDailyReport(shopId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ordersRes, lowStockRes, ledgerRes] = await Promise.all([
    supabase.from('orders').select('*').eq('shop_id', shopId).gte('created_at', today.toISOString()),
    supabase.from('products').select('*').eq('shop_id', shopId).lte('quantity', 5),
    supabase.from('ledger').select('*').eq('shop_id', shopId)
  ]);

  const orders = ordersRes.data || [];
  const lowStock = lowStockRes.data || [];
  const ledger = ledgerRes.data || [];

  const totalSales = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const totalBaaki = ledger.reduce((sum, l) => {
    return l.type === 'credit' ? sum + Number(l.amount) : sum - Number(l.amount);
  }, 0);

  let report = `📊 *Aaj ka Report*\n`;
  report += `📅 ${new Date().toLocaleDateString('en-IN')}\n\n`;
  report += `🛒 Orders aaj: ${orders.length}\n`;
  report += `💰 Total Sales: ₹${totalSales}\n`;
  report += `📒 Net Baaki: ₹${totalBaaki}\n\n`;

  if (lowStock.length > 0) {
    report += `⚠️ *Low Stock Alert:*\n`;
    lowStock.forEach(p => {
      report += `• ${p.name}: ${p.quantity} ${p.unit}\n`;
    });
  } else {
    report += `✅ Sab stock theek hai!`;
  }

  return report;
}

async function logMessage(shopId, direction, body, intent, fromPhone) {
  try {
    await supabase.from('messages').insert({
      shop_id: shopId,
      direction,
      body,
      intent,
      from_phone: fromPhone
    });
  } catch (err) {
    console.error('Log error:', err.message);
  }
}

module.exports = {
  handleAddStock,
  handleCheckStock,
  handleUpdatePrice,
  handleSetThreshold,
  handleDeleteProduct,
  handleAddOrder,
  handleCheckOrder,
  handleUpdateOrder,
  handleCancelOrder,
  handleAddLedger,
  handleAddPayment,
  handleCheckLedger,
  handleDeleteLedger,
  handleDailyReport,
  logMessage
};