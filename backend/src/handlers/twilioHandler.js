const twilio = require('twilio');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

const authMiddleware = require('../middleware/auth');
const { checkSubscription } = require('../middleware/subscription');
const { detectIntent } = require('../services/groq');
const supabase = require('../services/supabase');
const { sendWhatsAppAlert } = require('../services/twilio');
const {
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
} = require('./intentHandlers');

const {
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
} = require('./ragHandlers');


// Update RAG_INTENTS
const RAG_INTENTS = [
  'smart_forecast', 'smart_credit', 'smart_reorder',
  'smart_trends', 'smart_insights', 'smart_customer',
  'smart_lowstock', 'smart_pricing', 'smart_season',
  'smart_summary', 'smart_compare', 'smart_daily_plan',
  'smart_profit', 'smart_wastage'
];
async function downloadAudio(mediaUrl) {
  const auth = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString('base64');

  return new Promise((resolve, reject) => {
    function makeRequest(url, useAuth) {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: useAuth ? { Authorization: `Basic ${auth}` } : {}
      };

      lib.get(options, (httpRes) => {
        console.log('📥 Status:', httpRes.statusCode, '| URL:', url.slice(0, 60));
        console.log('📥 Content-Type:', httpRes.headers['content-type']);

        if ([301, 302, 307, 308].includes(httpRes.statusCode)) {
          const location = httpRes.headers.location;
          console.log('🔄 Redirecting to:', location);
          httpRes.resume();
          makeRequest(location, false);
          return;
        }

        const chunks = [];
        httpRes.on('data', chunk => chunks.push(chunk));
        httpRes.on('end', () => resolve({
          buffer: Buffer.concat(chunks),
          contentType: httpRes.headers['content-type']
        }));
        httpRes.on('error', reject);
      }).on('error', reject);
    }

    makeRequest(mediaUrl, true);
  });
}

async function transcribeAudio(mediaUrl, mediaContentType) {
  const { buffer, contentType } = await downloadAudio(mediaUrl);

  console.log('📦 Downloaded bytes:', buffer.length);
  console.log('📦 Content type:', contentType);

  let ext = 'ogg';
  let mimeType = 'audio/ogg';
  if (contentType && contentType.includes('mpeg')) { ext = 'mp3'; mimeType = 'audio/mpeg'; }
  else if (contentType && contentType.includes('mp4')) { ext = 'mp4'; mimeType = 'audio/mp4'; }
  else if (contentType && contentType.includes('ogg')) { ext = 'ogg'; mimeType = 'audio/ogg'; }

  const tmpFile = path.join(os.tmpdir(), `voice_${Date.now()}.${ext}`);
  fs.writeFileSync(tmpFile, buffer);
  console.log('💾 Saved to:', tmpFile);

  const formData = new FormData();
  formData.append('file', fs.createReadStream(tmpFile), {
    filename: `audio.${ext}`,
    contentType: mimeType
  });
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'text');
  formData.append('prompt', 'Hinglish shop conversation. English words: Maggi, soap, stock, order, report, baaki, jama, aaye. Names: Dhairya, Ram, Rahul, Priya. Numbers in digits.');

  const transcript = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        ...formData.getHeaders()
      }
    };

    const req = https.request(options, (httpRes) => {
      let data = '';
      httpRes.on('data', chunk => data += chunk);
      httpRes.on('end', () => {
        console.log('🔍 Groq Whisper response:', data);
        try {
          const result = JSON.parse(data);
          if (result.error) reject(new Error(result.error.message));
          else resolve(result.text);
        } catch (e) {
          if (data && data.trim().length > 0) resolve(data.trim());
          else reject(new Error('Empty transcript'));
        }
      });
    });

    req.on('error', reject);
    formData.pipe(req);
  });

  fs.unlinkSync(tmpFile);
  return transcript;
}

async function normalizeTranscript(hindiText) {
  const payload = JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'Convert to Hinglish Roman script. Return ONLY the converted text. No explanations.'
      },
      {
        role: 'user',
        content: `Convert this to Hinglish: ${hindiText}`
      }
    ],
    temperature: 0.1,
    max_tokens: 200
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
        try {
          const result = JSON.parse(data);
          const normalized = result.choices[0].message.content.trim();
          console.log('🔄 Normalized:', normalized);
          resolve(normalized);
        } catch (e) {
          console.error('Normalize error:', e.message);
          resolve(hindiText);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Normalize request error:', e.message);
      resolve(hindiText);
    });
    req.write(payload);
    req.end();
  });
}

// Process RAG in background and send proactive message
async function processRAGAndSend(intent, entities, text, shop, phone) {
  try {
    let reply;
    switch (intent) {
      case 'smart_reorder':
        reply = await handleSmartReorder(text, shop.id);
        break;
      case 'smart_trends':
        reply = await handleSmartTrends(text, shop.id);
        break;
      case 'smart_insights':
        reply = await handleSmartInsights(text, shop.id);
        break;
      case 'smart_customer':
        reply = await handleSmartCustomer(entities, text, shop.id);
        break;
      case 'smart_lowstock':
        reply = await handleSmartLowStock(text, shop.id);
        break;
      case 'smart_pricing':
        reply = await handleSmartPricing(entities, text, shop.id);
        break;
      case 'smart_season':
        reply = await handleSmartSeason(text, shop.id);
        break;
      case 'smart_credit':
        reply = await handleSmartCredit(text, shop.id);
        break;
      case 'smart_forecast':
        reply = await handleSmartForecast(text, shop.id);
        break;
      case 'smart_summary':
        reply = await handleSmartSummary(text, shop.id);
        break;
      case 'smart_compare':
        reply = await handleSmartCompare(entities, text, shop.id);
        break;
      case 'smart_daily_plan':
        reply = await handleSmartDailyPlan(text, shop.id);
        break;
      case 'smart_profit':
        reply = await handleSmartProfit(text, shop.id);
        break;
      case 'smart_wastage':
        reply = await handleSmartWastage(text, shop.id);
        break;
      default:
        reply = '❌ Samajh nahi aaya.';
    }

    console.log('📤 RAG reply ready, sending proactively...');
    await sendWhatsAppAlert(phone, reply);
    await logMessage(shop.id, 'outbound', reply, intent, phone);

  } catch (err) {
    console.error('❌ RAG processing error:', err.message);
    await sendWhatsAppAlert(phone, '❌ Analysis mein error aaya. Dobara try karo.');
  }
}

async function handleTwilioMessage(req, res) {
  const body = req.body;
  const from = body.From;
  const phone = from.replace('whatsapp:', '');

  const mediaUrl = body.MediaUrl0;
  const mediaType = body.MediaContentType0;
  let text = body.Body;
  const isVoice = !!(mediaUrl && mediaType && mediaType.includes('audio'));

  console.log(`📨 Message from ${phone}: "${text || '[voice message]'}"`);

  // Transcribe voice if audio
  if (isVoice) {
    console.log('🎤 Voice message received — transcribing...');
    try {
      const rawTranscript = await transcribeAudio(mediaUrl, mediaType);
      console.log(`🎤 Raw transcript: "${rawTranscript}"`);
      text = await normalizeTranscript(rawTranscript);
      console.log(`🎤 Final text: "${text}"`);
    } catch (err) {
      console.error('❌ Transcription error:', err.message);
      return sendReply(res, '❌ Voice message samajh nahi aaya. Please dobara bhejo.');
    }
  }

  if (!text) {
    return sendReply(res, '🤔 Kuch samajh nahi aaya. Text ya voice message bhejo.');
  }

  // Auth check
  const auth = await authMiddleware(phone);
  if (!auth) {
    return sendReply(res, 'Kuch gadbad ho gayi. Please dobara try karein.');
  }

  const { shop, isNew } = auth;

  // Welcome new user
  if (isNew) {
    await logMessage(shop.id, 'inbound', text, 'new_user', phone);
    const welcome = `🎉 *Welcome to WhatsApp Shop!*\n\nAapka account ban gaya! 14-din ka free trial shuru!\n\nYe try karein:\n• "20 Maggi aaye"\n• "Soap kitna bacha?"\n• "Ram ke liye 2 Maggi ka order"\n• "Rahul ka 500 baaki hai"\n• "Rahul ne 200 diya"\n• "Aaj ka report"\n• "Kya mangana chahiye?"\n• 🎤 Voice message bhi bhej sakte ho!`;
    await logMessage(shop.id, 'outbound', welcome, 'new_user', phone);
    return sendReply(res, welcome);
  }

  // Subscription check
  const subStatus = await checkSubscription(shop, phone);
  if (!subStatus.active) {
    await logMessage(shop.id, 'outbound', subStatus.message, 'subscription_expired', phone);
    return sendReply(res, subStatus.message);
  }

  const normalizedText = text.toLowerCase().trim();
  const confirmWords = ['haan', 'yes', 'ha', 'haa'];
  const cancelWords = ['nahi', 'no', 'nah', 'cancel'];

  // Handle "haan" — confirm pending voice action
  if (confirmWords.includes(normalizedText)) {
    const { data: pending } = await supabase
      .from('messages')
      .select('*')
      .eq('shop_id', shop.id)
      .eq('intent', 'pending_confirmation')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (pending) {
      const { intent, entities } = JSON.parse(pending.body);

      await supabase
        .from('messages')
        .update({ intent: 'confirmed' })
        .eq('id', pending.id);

      let reply;
      switch (intent) {
        case 'add_stock': reply = await handleAddStock(entities, shop.id); break;
        case 'add_order': reply = await handleAddOrder(entities, shop.id); break;
        case 'add_ledger': reply = await handleAddLedger(entities, shop.id); break;
        case 'add_payment': reply = await handleAddPayment(entities, shop.id); break;
        default: reply = '✅ Done!';
      }

      await logMessage(shop.id, 'outbound', reply, intent, phone);
      return sendReply(res, reply);
    } else {
      return sendReply(res, '🤔 Koi pending action nahi mila. Pehle voice message bhejo.');
    }
  }

  // Handle "nahi" — cancel pending voice action
  if (cancelWords.includes(normalizedText)) {
    await supabase
      .from('messages')
      .update({ intent: 'cancelled' })
      .eq('shop_id', shop.id)
      .eq('intent', 'pending_confirmation');

    return sendReply(res, '❌ Cancelled! Dobara voice message bhejo ya type karo.');
  }

  // Any other text — cancel pending confirmation
  if (!isVoice) {
    const { data: existing } = await supabase
      .from('messages')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('intent', 'pending_confirmation')
      .single();

    if (existing) {
      await supabase
        .from('messages')
        .update({ intent: 'cancelled' })
        .eq('id', existing.id);
      console.log('🗑️ Pending confirmation auto-cancelled');
    }
  }

  try {
    console.log('🧠 Detecting intent...');
    const result = await detectIntent(text, { shopName: shop.shop_name });
    console.log('Intent:', result.intent, '| Entities:', result.entities);

    await logMessage(shop.id, 'inbound', text, result.intent, phone);

    // RAG intents — respond immediately + process in background
    if (RAG_INTENTS.includes(result.intent)) {
      sendReply(res, '🤔 Analysis kar raha hoon... ek second! ⏳');
      processRAGAndSend(result.intent, result.entities, text, shop, phone);
      return;
    }

    // Voice confirmation for write intents
    const writeIntents = ['add_stock', 'add_order', 'add_ledger', 'add_payment'];
    if (isVoice && writeIntents.includes(result.intent)) {
      const entities = result.entities;
      let confirmMsg = `🎤 *Voice message samjha:*\n\n`;
      let retryExample = '';

      switch (result.intent) {
        case 'add_stock':
          confirmMsg += `📦 *Stock add:*\n• Product: ${entities.product || '?'}\n• Quantity: ${entities.quantity || '?'} ${entities.unit || 'units'}`;
          if (entities.price) confirmMsg += `\n• Price: ₹${entities.price}`;
          retryExample = `"${entities.quantity || '10'} ${entities.product || 'product'} aaye"`;
          break;
        case 'add_order':
          confirmMsg += `🛒 *Order:*\n• Product: ${entities.product || '?'}\n• Quantity: ${entities.quantity || 1}\n• Customer: ${entities.customer || 'Walk-in'}`;
          retryExample = `"${entities.customer || 'Ram'} ke liye ${entities.quantity || '1'} ${entities.product || 'product'} order"`;
          break;
        case 'add_ledger':
          confirmMsg += `📒 *Baaki add:*\n• Customer: ${entities.customer || '?'}\n• Amount: ₹${entities.amount || '?'}`;
          retryExample = `"${entities.customer || 'Rahul'} ka ${entities.amount || '500'} baaki hai"`;
          break;
        case 'add_payment':
          confirmMsg += `💰 *Payment received:*\n• Customer: ${entities.customer || '?'}\n• Amount: ₹${entities.amount || '?'}`;
          retryExample = `"${entities.customer || 'Rahul'} ne ${entities.amount || '500'} diya"`;
          break;
      }

      confirmMsg += `\n\n━━━━━━━━━━━━━━━\n✅ Confirm karo:\n*"haan"* → save karo\n*"nahi"* → cancel karo\n\n✏️ Galat hai? Seedha type karo:\n${retryExample}`;

      await supabase.from('messages').insert({
        shop_id: shop.id,
        direction: 'outbound',
        body: JSON.stringify({ intent: result.intent, entities: result.entities }),
        intent: 'pending_confirmation',
        from_phone: phone
      });

      return sendReply(res, confirmMsg);
    }

    // Normal text intents — execute directly
    let reply;
    switch (result.intent) {
    case 'add_stock':
      reply = await handleAddStock(result.entities, shop.id);
      break;
    case 'check_stock':
      reply = await handleCheckStock(result.entities, shop.id);
      break;
    case 'update_price':
      reply = await handleUpdatePrice(result.entities, shop.id);
      break;
    case 'set_threshold':
      reply = await handleSetThreshold(result.entities, shop.id);
      break;
    case 'delete_product':
      reply = await handleDeleteProduct(result.entities, shop.id);
      break;
    case 'add_order':
      reply = await handleAddOrder(result.entities, shop.id);
      break;
    case 'check_order':
      reply = await handleCheckOrder(result.entities, shop.id);
      break;
    case 'update_order':
      reply = await handleUpdateOrder(result.entities, shop.id);
      break;
    case 'cancel_order':
      reply = await handleCancelOrder(result.entities, shop.id);
      break;
    case 'add_ledger':
      reply = await handleAddLedger(result.entities, shop.id);
      break;
    case 'add_payment':
      reply = await handleAddPayment(result.entities, shop.id);
      break;
    case 'check_ledger':
      reply = await handleCheckLedger(result.entities, shop.id);
      break;
    case 'delete_ledger':
      reply = await handleDeleteLedger(result.entities, shop.id);
      break;
    case 'daily_report':
      reply = await handleDailyReport(shop.id);
      break;
    default:
      reply = `🤖 Samajh nahi aaya: "${text}"\n\nYe try karein:\n• "20 Maggi aaye"\n• "Stock check karo"\n• "Aaj ka report"\n• "Kya mangana chahiye?"\n• "Maggi ka price 15 kar do"\n• "Ram ka order cancel karo"\n• 🎤 Voice message bhi bhej sakte ho!`;
  }

    await logMessage(shop.id, 'outbound', reply, result.intent, phone);
    sendReply(res, reply);

  } catch (err) {
    console.error('❌ Error:', err.message);
    sendReply(res, 'Kuch gadbad ho gayi. Please dobara try karein.');
  }
}

function sendReply(res, text) {
  const twiml = new twilio.twiml.MessagingResponse();
  const safeText = text.length > 1500 ? text.slice(0, 1497) + '...' : text;
  twiml.message(safeText);
  res.type('text/xml');
  res.send(twiml.toString());
}

module.exports = { handleTwilioMessage };