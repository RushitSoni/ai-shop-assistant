const { ragQuery } = require('../services/rag');

async function handleSmartReorder(question, shopId) {
  console.log('🧠 RAG: smart_reorder');
  return await ragQuery(
    `Based on current stock levels and recent sales, what should I reorder urgently? Prioritize by sales velocity and stock remaining days. ${question}`,
    shopId, 'reorder'
  );
}

async function handleSmartTrends(question, shopId) {
  console.log('🧠 RAG: smart_trends');
  return await ragQuery(
    `What are the top selling products this week? Rank by quantity sold and revenue. What sells most? ${question}`,
    shopId, 'trends'
  );
}

async function handleSmartInsights(question, shopId) {
  console.log('🧠 RAG: smart_insights');
  return await ragQuery(
    `Give smart business insights about today's performance, stock health, pending payments, and 3 actionable recommendations. ${question}`,
    shopId, 'insights'
  );
}

async function handleSmartCustomer(entities, question, shopId) {
  console.log('🧠 RAG: smart_customer');
  const customerName = entities.customer || '';
  return await ragQuery(
    `Tell me everything about customer ${customerName} — their orders history, payment history, pending balance, and payment behavior. ${question}`,
    shopId, 'customer'
  );
}

async function handleSmartLowStock(question, shopId) {
  console.log('🧠 RAG: smart_lowstock');
  return await ragQuery(
    `Which products are running low or will run out soon based on sales velocity? Prioritize by urgency. What to reorder first? ${question}`,
    shopId, 'lowstock'
  );
}

async function handleSmartPricing(entities, question, shopId) {
  console.log('🧠 RAG: smart_pricing');
  const product = entities.product || '';
  return await ragQuery(
    `Analyze pricing for ${product}. Is current price optimal based on sales volume? Should I adjust? Compare with other products. ${question}`,
    shopId, 'pricing'
  );
}

async function handleSmartSeason(question, shopId) {
  console.log('🧠 RAG: smart_season');
  return await ragQuery(
    `Based on current inventory and sales patterns, what seasonal or festival stock should I prepare? What items to stock more of? ${question}`,
    shopId, 'season'
  );
}

async function handleSmartCredit(question, shopId) {
  console.log('🧠 RAG: smart_credit');
  return await ragQuery(
    `Who owes the most money? Rank customers by pending balance. Who should I follow up with first for payment? ${question}`,
    shopId, 'credit'
  );
}

async function handleSmartForecast(question, shopId) {
  console.log('🧠 RAG: smart_forecast');
  return await ragQuery(
    `Based on last week sales velocity, forecast this week expected sales and revenue. Which products will run out first? Give day-wise estimate if possible. ${question}`,
    shopId, 'forecast'
  );
}

async function handleSmartSummary(question, shopId) {
  console.log('🧠 RAG: smart_summary');
  return await ragQuery(
    `Give a complete business summary — top sellers, low stock alerts, pending payments, today's revenue, and top 3 actionable recommendations for the shop owner. ${question}`,
    shopId, 'summary'
  );
}

async function handleSmartCompare(entities, question, shopId) {
  console.log('🧠 RAG: smart_compare');
  const product = entities.product || '';
  return await ragQuery(
    `Compare products in the shop by sales performance. ${product ? `Specifically compare ${product} with others.` : ''} Which sells more, which gives more revenue? ${question}`,
    shopId, 'compare'
  );
}

async function handleSmartDailyPlan(question, shopId) {
  console.log('🧠 RAG: smart_daily_plan');
  return await ragQuery(
    `Based on current stock, pending orders, customer balances, and sales trends — what should the shop owner prioritize doing today? Give a practical action plan. ${question}`,
    shopId, 'daily_plan'
  );
}

async function handleSmartProfit(question, shopId) {
  console.log('🧠 RAG: smart_profit');
  return await ragQuery(
    `Calculate profit/margin analysis. Based on sales revenue and product prices, what is the estimated profit this week? Which products have best margins? ${question}`,
    shopId, 'profit'
  );
}

async function handleSmartWastage(question, shopId) {
  console.log('🧠 RAG: smart_wastage');
  return await ragQuery(
    `Which products are slow moving or not selling? Identify dead stock that is taking up space. What should I discount or stop ordering? ${question}`,
    shopId, 'wastage'
  );
}

module.exports = {
  handleSmartReorder,
  handleSmartTrends,
  handleSmartInsights,
  handleSmartCustomer,
  handleSmartLowStock,
  handleSmartPricing,
  handleSmartSeason,
  handleSmartCredit,
  handleSmartForecast,
  handleSmartSummary,
  handleSmartCompare,
  handleSmartDailyPlan,
  handleSmartProfit,
  handleSmartWastage
};