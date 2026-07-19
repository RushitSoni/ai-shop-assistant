const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Load shared prompt
const BASE_PROMPT = fs.readFileSync(
  path.join(__dirname, 'prompt.txt'), 
  'utf8'
);

async function detectIntent(message, shopContext) {
  const prompt = `${BASE_PROMPT}

Shop context: ${JSON.stringify(shopContext)}
Message: "${message}"

IMPORTANT: Return ONLY the JSON object. No explanation, no text before or after.`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { 
        role: 'system', 
        content: 'You are a JSON-only response bot. Never write explanations. Always respond with valid JSON only.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 300
  });

  const text = response.choices[0].message.content.trim();
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error('Intent parse error:', e.message);
    console.error('Raw response:', text);
    return { intent: 'unknown', entities: {}, reply_hint: '' };
  }
}

module.exports = { detectIntent };