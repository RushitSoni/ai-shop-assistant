const supabase = require('./supabase');
const https = require('https');

async function ragQuery(question, shopId, contextType) {
  const context = await buildContext(shopId, contextType, question);
  const answer = await generateAnswer(question, context);
  
  logRAGCall(shopId, question, context, answer).catch(err =>
    console.log('RAG log failed:', err.message)
  );

  return answer;
}

async function buildContext(shopId, contextType, question) {
  const context = {};
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [productsRes, ordersRes, ledgerRes] = await Promise.all([
    supabase.from('products').select('*').eq('shop_id', shopId).order('quantity', { ascending: true }),
    supabase.from('orders').select('*').eq('shop_id', shopId).gte('created_at', weekAgo.toISOString()).order('created_at', { ascending: false }),
    supabase.from('ledger').select('*').eq('shop_id', shopId).order('created_at', { ascending: false })
  ]);

  context.all_products = productsRes.data || [];
  context.recent_orders = ordersRes.data || [];
  context.ledger = ledgerRes.data || [];

  // Vector search for relevant products
  if (question) {
    try {
      const { getEmbedding } = require('./embeddings');
      const queryEmbedding = await getEmbedding(question);
      const { data: similarProducts } = await supabase.rpc('match_products', {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 5,
        shop_id_filter: shopId
      });
      context.relevant_products = similarProducts || [];
      console.log('🔍 Vector search found:', context.relevant_products.length, 'similar products');
    } catch (err) {
      console.log('Vector search skipped:', err.message);
      context.relevant_products = [];
    }
  }

  // Sales by product
  const salesByProduct = {};
  context.recent_orders.forEach(order => {
    (order.items_json || []).forEach(item => {
      if (!salesByProduct[item.name]) salesByProduct[item.name] = { qty: 0, revenue: 0 };
      salesByProduct[item.name].qty += item.qty;
      salesByProduct[item.name].revenue += (item.price || 0) * item.qty;
    });
  });
  context.sales_by_product = salesByProduct;

  // Customer balances
  const customerBalances = {};
  context.ledger.forEach(l => {
    if (!customerBalances[l.customer_name]) customerBalances[l.customer_name] = 0;
    customerBalances[l.customer_name] += l.type === 'credit' ? Number(l.amount) : -Number(l.amount);
  });
  context.customer_balances = customerBalances;

  return context;
}

async function generateAnswer(question, context) {
  const contextStr = `
SHOP DATA:

PRODUCTS (sorted by quantity, lowest first):
${context.all_products.map(p =>
  `- ${p.name}: ${p.quantity} ${p.unit} (threshold: ${p.low_threshold}, price: ₹${p.price || 0})`
).join('\n') || 'No products'}

${context.relevant_products && context.relevant_products.length > 0 ?
`SEMANTICALLY RELEVANT PRODUCTS:
${context.relevant_products.map(p =>
  `- ${p.name}: ${p.quantity} ${p.unit} (similarity: ${p.similarity?.toFixed(2)})`
).join('\n')}` : ''}

SALES LAST 7 DAYS:
${Object.entries(context.sales_by_product).map(([name, data]) =>
  `- ${name}: ${data.qty} units sold, ₹${data.revenue} revenue`
).join('\n') || 'No sales this week'}

RECENT ORDERS (last 7 days): ${context.recent_orders.length} orders
Total Revenue: ₹${context.recent_orders.reduce((sum, o) => sum + Number(o.total_amount), 0)}

CUSTOMER BALANCES (who owes money):
${Object.entries(context.customer_balances)
  .filter(([_, bal]) => bal > 0)
  .sort(([_, a], [__, b]) => b - a)
  .map(([name, bal]) => `- ${name}: ₹${bal}`)
  .join('\n') || 'No pending balances'}

LOW STOCK ITEMS:
${context.all_products
  .filter(p => p.quantity <= p.low_threshold)
  .map(p => `- ${p.name}: ${p.quantity} ${p.unit} (URGENT)`)
  .join('\n') || 'All stock levels OK'}
`;

  const payload = JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `You are a smart business assistant for an Indian kirana shop. 
Answer ONLY based on the shop data provided. 
If data is not available, say so clearly.
Reply in Hinglish (mix of Hindi and English).
Be specific with numbers. Be concise but helpful.
Format with emojis for WhatsApp readability.
DO NOT make up data that is not in the context.`
      },
      {
        role: 'user',
        content: `Shop Data:\n${contextStr}\n\nQuestion: ${question}`
      }
    ],
    temperature: 0.3,
    max_tokens: 800
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (httpRes) => {
      let data = '';
      httpRes.on('data', chunk => data += chunk);
      httpRes.on('end', () => {
        console.log('🔍 RAG Groq status:', httpRes.statusCode);
        try {
          const result = JSON.parse(data);
          if (result.error) {
            reject(new Error(result.error.message));
          } else {
            resolve(result.choices[0].message.content.trim());
          }
        } catch (e) {
          reject(new Error('RAG parse failed: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function logRAGCall(shopId, question, context, answer) {
  await supabase.from('rag_logs').insert({
    shop_id: shopId,
    question,
    context: JSON.stringify(context),
    answer,
    created_at: new Date().toISOString()
  });
}

module.exports = { ragQuery, buildContext, generateAnswer };