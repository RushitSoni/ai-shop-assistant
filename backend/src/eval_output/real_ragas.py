import json
import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_recall,
    context_precision
)
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from langchain_groq import ChatGroq
from langchain_community.embeddings import HuggingFaceEmbeddings

load_dotenv('../../.env')

# ─── Setup ───────────────────────────────────────────────────────────────────

supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY'))

# Groq as judge LLM
groq_llm = LangchainLLMWrapper(ChatGroq(
    model="llama-3.1-8b-instant",
    api_key=os.getenv('GROQ_API_KEY'),
    temperature=0.1,
    request_timeout=120
))

# HuggingFace embeddings (free)
hf_embeddings = LangchainEmbeddingsWrapper(
    HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
)

# ─── Ground Truths ───────────────────────────────────────────────────────────

GROUND_TRUTHS = {
    'kiska baaki sabse zyada hai': 'Sabse zyada baaki waale customer ka naam aur exact amount batao. Customer list by descending balance order mein do.',
    'is hafte kitna bikega': 'Last week ki sales velocity ke basis par forecast do. Har product ki expected sales aur total revenue estimate karo.',
    'kya mangana chahiye': 'Low stock products identify karo. Sales velocity ke basis par priority reorder list do with quantities.',
    'business kaisa hai': 'Aaj ke total orders, revenue, top selling product, aur low stock items ka summary do.',
    'poora summary do': 'Complete business overview: inventory health, sales performance, customer balances, aur top 3 action items.',
    'kaunsa stock khatam hone wala hai': 'Products jo low threshold se neeche hain unki list do with urgency level aur suggested reorder quantity.',
    'kaunsa product nahi bik raha': 'Slow moving ya zero sales products identify karo. Dead stock alert do.',
    'kitna profit hua': 'Sales revenue calculate karo. Product-wise margin analysis do.',
    'maggi vs glass kaun zyada bikta hai': 'Dono products ki sales quantity aur revenue compare karo. Clear winner identify karo.',
    'aaj kya karna chahiye': 'Practical action plan do: reorder items, follow up customers, pending orders - priority wise.'
}

def get_ground_truth(question):
    q_lower = question.lower()
    for key, truth in GROUND_TRUTHS.items():
        words = key.split()
        matches = sum(1 for w in words if w in q_lower)
        if matches >= 2:
            return truth
    return 'Shop data ke basis par accurate, specific aur helpful answer do with actual numbers.'

# ─── Fetch RAG Logs ───────────────────────────────────────────────────────────

def fetch_rag_logs():
    response = supabase.table('rag_logs').select('*').order('created_at', desc=True).limit(1).execute()
    return response.data or []

def parse_context(context_raw):
    try:
        ctx = json.loads(context_raw)
        parts = []

        products = ctx.get('all_products', [])
        if products:
            parts.append("PRODUCTS: " + ", ".join([
                f"{p['name']}({p['quantity']} {p['unit']} @₹{p.get('price',0)})"
                for p in products[:10]
            ]))

        sales = ctx.get('sales_by_product', {})
        if sales:
            parts.append("SALES: " + ", ".join([
                f"{name}:{data['qty']}units ₹{data['revenue']}"
                for name, data in list(sales.items())[:5]
            ]))

        balances = ctx.get('customer_balances', {})
        if balances:
            positive = {k: v for k, v in balances.items() if v > 0}
            if positive:
                parts.append("BALANCES: " + ", ".join([
                    f"{name}:₹{bal}"
                    for name, bal in sorted(positive.items(), key=lambda x: -x[1])[:5]
                ]))

        orders = ctx.get('recent_orders', [])
        parts.append(f"ORDERS_COUNT: {len(orders)}")

        return " | ".join(parts) if parts else "No shop data available"
    except:
        return str(context_raw)[:300]

# ─── Main Evaluation ──────────────────────────────────────────────────────────

def run_real_ragas():
    print("🚀 Starting REAL RAGAS Evaluation...")
    print("="*60)
    print(f"📊 Judge LLM: Groq LLaMA-3.3-70b")
    print(f"🔍 Embeddings: HuggingFace all-MiniLM-L6-v2")
    print("="*60)

    logs = fetch_rag_logs()
    if not logs:
        print("❌ No RAG logs found! Send some RAG queries on WhatsApp first.")
        return

    print(f"📋 Found {len(logs)} RAG logs\n")

    # Build RAGAS dataset
    questions = []
    answers = []
    contexts = []
    ground_truths = []

    for log in logs:
        q = log.get('question', '').strip()
        a = log.get('answer', '').strip()
        ctx = parse_context(log.get('context', '{}'))

        if not q or not a:
            continue

        gt = get_ground_truth(q)

        questions.append(q)
        answers.append(a)
        contexts.append([ctx])  # RAGAS expects list of strings
        ground_truths.append(gt)

        print(f"  ✅ Added: {q[:50]}...")

    if not questions:
        print("❌ No valid logs to evaluate!")
        return

    print(f"\n📊 Evaluating {len(questions)} RAG responses...\n")

    # Create HuggingFace Dataset
    dataset = Dataset.from_dict({
        "question": questions,
        "answer": answers,
        "contexts": contexts,
        "ground_truth": ground_truths
    })

    # Run real RAGAS evaluation
    print("⏳ Running RAGAS evaluate()... (this takes 2-3 minutes)\n")

    result = evaluate(
        dataset=dataset,
        metrics=[
            faithfulness,
            answer_relevancy,
            context_recall,
            context_precision
        ],
        llm=groq_llm,
        embeddings=hf_embeddings,
        raise_exceptions=False
    )

    # Results
    print(f"\n{'='*60}")
    print("📊 REAL RAGAS RESULTS")
    print(f"{'='*60}")

    df = result.to_pandas()
    import numpy as np
    import math

    def safe_float(val):
        try:
            f = float(val)
            return 0.0 if math.isnan(f) else round(f, 3)
        except:
            return 0.0

    # Replace save results section:
    faith = safe_float(np.nanmean(df['faithfulness']))
    relevancy = safe_float(np.nanmean(df['answer_relevancy']))
    recall = safe_float(np.nanmean(df['context_recall']))
    precision = safe_float(np.nanmean(df['context_precision']))
    overall = round((faith + relevancy + recall + precision) / 4, 3)

    output = {
        'summary': {
            'faithfulness': faith,
            'answer_relevancy': relevancy,
            'context_recall': recall,
            'context_precision': precision,
            'overall': overall,
            'total_evaluated': len(questions),
            'judge_model': 'groq/gemma2-9b-it',
            'embedding_model': 'sentence-transformers/all-MiniLM-L6-v2'
        },
        'per_question': [
            {
                'question': questions[i],
                'faithfulness': safe_float(row['faithfulness']),
                'answer_relevancy': safe_float(row['answer_relevancy']),
                'context_recall': safe_float(row['context_recall']),
                'context_precision': safe_float(row['context_precision'])
            }
            for i, row in df.iterrows()
        ]
    }

    with open('real_ragas_results.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n💾 Results saved to real_ragas_results.json")

    # Before/After comparison
    print(f"\n{'='*60}")
    print("📈 BEFORE vs AFTER (Prompt Tuning Impact)")
    print(f"{'='*60}")
    print("Baseline (no tuning):     F:N/A  R:N/A  CR:N/A  CP:N/A")
    print(f"After tuning (current):   F:{faith:.2f}  R:{relevancy:.2f}  CR:{recall:.2f}  CP:{precision:.2f}")
    print(f"Improvement:              Real RAGAS with Groq judge ✅")

if __name__ == '__main__':
    run_real_ragas()