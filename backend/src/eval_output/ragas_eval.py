import json
import os
import time
from groq import Groq
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('../../.env')

client = Groq(api_key=os.getenv('GROQ_API_KEY'))
supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY'))

# ─── Ground Truth for RAG queries ────────────────────────────────────────────
# Add ground truth for each question type
GROUND_TRUTHS = {
  'kiska baaki sabse zyada hai': 'Sabse zyada baaki waale customer ka naam aur amount batao',
  'is hafte kitna bikega': 'Last week ki sales ke basis par is hafte ka forecast do',
  'kya mangana chahiye': 'Low stock products aur sales velocity ke basis par reorder suggestions do',
  'business kaisa hai': 'Aaj ke orders, sales, aur stock health ka summary do',
  'poora summary do': 'Inventory, sales, baaki, aur low stock ka complete overview do',
  'kaunsa stock khatam hone wala hai': 'Low stock items list karo with urgency level',
}

def get_ground_truth(question):
  q_lower = question.lower()
  for key, truth in GROUND_TRUTHS.items():
    if any(word in q_lower for word in key.split()):
      return truth
  return 'Shop data ke basis par accurate aur helpful answer do'

# ─── RAGAS Metrics using Groq ─────────────────────────────────────────────────

def evaluate_faithfulness(question, context, answer):
  """Check if answer is grounded in context — no hallucination"""
  prompt = f"""You are evaluating an AI answer for faithfulness.

Question: {question}
Context (shop data available): {context[:500]}
Answer given: {answer}

Rate faithfulness from 0.0 to 1.0:
- 1.0 = Every claim in answer is supported by context
- 0.5 = Some claims supported, some not
- 0.0 = Answer makes up data not in context

Return ONLY a number between 0.0 and 1.0"""

  response = client.chat.completions.create(
    model='llama-3.3-70b-versatile',
    messages=[{'role': 'user', 'content': prompt}],
    temperature=0.1,
    max_tokens=10
  )
  try:
    return float(response.choices[0].message.content.strip())
  except:
    return 0.5

def evaluate_answer_relevancy(question, answer):
  """Check if answer actually addresses the question"""
  prompt = f"""You are evaluating answer relevancy.

Question: {question}
Answer: {answer}

Rate relevancy from 0.0 to 1.0:
- 1.0 = Answer directly and completely addresses the question
- 0.5 = Partially answers the question
- 0.0 = Answer is completely off-topic

Return ONLY a number between 0.0 and 1.0"""

  response = client.chat.completions.create(
    model='llama-3.3-70b-versatile',
    messages=[{'role': 'user', 'content': prompt}],
    temperature=0.1,
    max_tokens=10
  )
  try:
    return float(response.choices[0].message.content.strip())
  except:
    return 0.5

def evaluate_context_recall(question, context, ground_truth):
  """Check if context has enough info to answer correctly"""
  prompt = f"""You are evaluating context recall.

Question: {question}
Ground Truth (what a good answer should cover): {ground_truth}
Context retrieved: {context[:500]}

Rate context recall from 0.0 to 1.0:
- 1.0 = Context has all information needed to answer correctly
- 0.5 = Context has some relevant information
- 0.0 = Context is missing critical information

Return ONLY a number between 0.0 and 1.0"""

  response = client.chat.completions.create(
    model='llama-3.3-70b-versatile',
    messages=[{'role': 'user', 'content': prompt}],
    temperature=0.1,
    max_tokens=10
  )
  try:
    return float(response.choices[0].message.content.strip())
  except:
    return 0.5

def evaluate_context_precision(question, context, answer):
  """Check if retrieved context was actually used in answer"""
  prompt = f"""You are evaluating context precision.

Question: {question}
Context retrieved: {context[:500]}
Answer given: {answer}

Rate context precision from 0.0 to 1.0:
- 1.0 = All retrieved context was relevant and used in answer
- 0.5 = Some context was relevant, some was noise
- 0.0 = Retrieved context was mostly irrelevant

Return ONLY a number between 0.0 and 1.0"""

  response = client.chat.completions.create(
    model='llama-3.3-70b-versatile',
    messages=[{'role': 'user', 'content': prompt}],
    temperature=0.1,
    max_tokens=10
  )
  try:
    return float(response.choices[0].message.content.strip())
  except:
    return 0.5

# ─── Main Evaluation ──────────────────────────────────────────────────────────

def run_ragas_eval():
  print("🚀 Starting RAGAS Evaluation...")
  print("="*60)

  # Fetch RAG logs from Supabase
  response = supabase.table('rag_logs').select('*').order('created_at', desc=True).limit(20).execute()
  logs = response.data

  if not logs:
    print("❌ No RAG logs found! Send some RAG queries first.")
    return

  print(f"📊 Evaluating {len(logs)} RAG calls\n")

  results = []

  for i, log in enumerate(logs):
    question = log.get('question', '')
    answer = log.get('answer', '')
    context_raw = log.get('context', '{}')

    # Parse context
    try:
      context_obj = json.loads(context_raw)
      # Extract readable context
      products = context_obj.get('all_products', [])
      sales = context_obj.get('sales_by_product', {})
      balances = context_obj.get('customer_balances', {})
      context_str = f"Products: {[p['name'] for p in products[:5]]} | Sales: {list(sales.keys())[:3]} | Balances: {list(balances.keys())[:3]}"
    except:
      context_str = str(context_raw)[:200]

    ground_truth = get_ground_truth(question)

    print(f"[{i+1}/{len(logs)}] Evaluating: {question[:50]}...")

    # Run all 4 RAGAS metrics
    faithfulness = evaluate_faithfulness(question, context_str, answer)
    time.sleep(0.5)
    relevancy = evaluate_answer_relevancy(question, answer)
    time.sleep(0.5)
    recall = evaluate_context_recall(question, context_str, ground_truth)
    time.sleep(0.5)
    precision = evaluate_context_precision(question, context_str, answer)
    time.sleep(0.5)

    result = {
      'question': question,
      'answer_preview': answer[:100],
      'faithfulness': faithfulness,
      'answer_relevancy': relevancy,
      'context_recall': recall,
      'context_precision': precision,
      'avg_score': (faithfulness + relevancy + recall + precision) / 4
    }
    results.append(result)

    status = '✅' if result['avg_score'] >= 0.7 else '⚠️'
    print(f"  {status} F:{faithfulness:.2f} R:{relevancy:.2f} CR:{recall:.2f} CP:{precision:.2f} | Avg:{result['avg_score']:.2f}")

  # Summary
  print(f"\n{'='*60}")
  print("📊 RAGAS EVALUATION RESULTS")
  print(f"{'='*60}")

  avg_faithfulness = sum(r['faithfulness'] for r in results) / len(results)
  avg_relevancy = sum(r['answer_relevancy'] for r in results) / len(results)
  avg_recall = sum(r['context_recall'] for r in results) / len(results)
  avg_precision = sum(r['context_precision'] for r in results) / len(results)
  overall = (avg_faithfulness + avg_relevancy + avg_recall + avg_precision) / 4

  print(f"✅ Faithfulness:       {avg_faithfulness:.2f}  (target: >0.85) {'✅' if avg_faithfulness >= 0.85 else '⚠️ needs tuning'}")
  print(f"📌 Answer Relevancy:   {avg_relevancy:.2f}  (target: >0.80) {'✅' if avg_relevancy >= 0.80 else '⚠️ needs tuning'}")
  print(f"🔍 Context Recall:     {avg_recall:.2f}  (target: >0.75) {'✅' if avg_recall >= 0.75 else '⚠️ needs tuning'}")
  print(f"🎯 Context Precision:  {avg_precision:.2f}  (target: >0.75) {'✅' if avg_precision >= 0.75 else '⚠️ needs tuning'}")
  print(f"\n🏆 Overall RAGAS Score: {overall:.2f}")

  # Recommendations
  print(f"\n{'='*60}")
  print("💡 RECOMMENDATIONS")
  print(f"{'='*60}")

  if avg_faithfulness < 0.85:
    print("⚠️  Low faithfulness — add to system prompt:")
    print('   "Answer ONLY from provided shop data. If unsure, say so."')

  if avg_relevancy < 0.80:
    print("⚠️  Low relevancy — improve RAG intent detection in prompt.txt")

  if avg_recall < 0.75:
    print("⚠️  Low context recall — fetch more data in buildContext()")

  if avg_precision < 0.75:
    print("⚠️  Low precision — filter context more specifically per intent")

  if overall >= 0.80:
    print("✅ RAG pipeline is production ready!")
  else:
    print("⚠️  RAG needs improvement before production")

  # Save results
  with open('ragas_results.json', 'w') as f:
    json.dump({
      'summary': {
        'faithfulness': avg_faithfulness,
        'answer_relevancy': avg_relevancy,
        'context_recall': avg_recall,
        'context_precision': avg_precision,
        'overall': overall,
        'total_evaluated': len(results)
      },
      'details': results
    }, f, indent=2)

  print(f"\n💾 Results saved to ragas_results.json")

  # Before/After comparison
  print(f"\n{'='*60}")
  print("📈 BEFORE/AFTER COMPARISON")
  print(f"{'='*60}")
  print("BEFORE prompt tuning (baseline):")
  print("  Faithfulness: N/A | Relevancy: N/A | Recall: N/A | Precision: N/A")
  print(f"\nAFTER current implementation:")
  print(f"  Faithfulness: {avg_faithfulness:.2f} | Relevancy: {avg_relevancy:.2f} | Recall: {avg_recall:.2f} | Precision: {avg_precision:.2f}")

if __name__ == '__main__':
  run_ragas_eval()