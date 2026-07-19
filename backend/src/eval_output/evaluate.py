import json
import os
import re
import time
from groq import Groq
from dotenv import load_dotenv

load_dotenv('../../.env')

client = Groq(api_key=os.getenv('GROQ_API_KEY'))

# Load shared prompt — same file as Node.js uses!
with open('../services/prompt.txt') as f:
    BASE_PROMPT = f.read()

with open('test_dataset.json') as f:
    dataset = json.load(f)

def detect_intent(message):
    prompt = f"{BASE_PROMPT}\n\nMessage: \"{message}\""
    response = client.chat.completions.create(
        model='llama-3.3-70b-versatile',
        messages=[{'role': 'user', 'content': prompt}],
        temperature=0.1,
        max_tokens=200
    )
    text = response.choices[0].message.content.strip()
    clean = re.sub(r'```json|```', '', text).strip()
    return json.loads(clean)

def evaluate_intent_accuracy(results):
    correct = sum(1 for r in results if r['predicted_intent'] == r['ground_truth_intent'])
    return correct / len(results)

def evaluate_entity_accuracy(results):
    scores = []
    for r in results:
        gt = r['ground_truth_entities']
        pred = r['predicted_entities']
        if not gt:
            scores.append(1.0)
            continue
        matches = 0
        total = len(gt)
        for key, val in gt.items():
            pred_val = pred.get(key)
            if pred_val is None:
                continue
            if isinstance(val, str) and isinstance(pred_val, str):
                if val.lower() in pred_val.lower() or pred_val.lower() in val.lower():
                    matches += 1
            elif val == pred_val:
                matches += 1
        scores.append(matches / total)
    return sum(scores) / len(scores)

def check_hallucination(results):
    hallucinations = sum(1 for r in results if r['predicted_intent'] == 'unknown')
    return hallucinations / len(results)

# Run evaluation
print("🚀 Starting evaluation...")
print(f"📊 Total test cases: {len(dataset)}\n")

results = []
errors = 0

for i, item in enumerate(dataset):
    try:
        result = detect_intent(item['question'])
        results.append({
            'id': item['id'],
            'question': item['question'],
            'ground_truth_intent': item['ground_truth_intent'],
            'predicted_intent': result['intent'],
            'ground_truth_entities': item['ground_truth_entities'],
            'predicted_entities': result['entities'],
            'intent_correct': result['intent'] == item['ground_truth_intent']
        })
        status = '✅' if result['intent'] == item['ground_truth_intent'] else '❌'
        print(f"{status} [{i+1}/50] {item['question'][:40]:<40} → {result['intent']}")
        time.sleep(0.3)
    except Exception as e:
        print(f"⚠️  [{i+1}/50] Error: {e}")
        errors += 1

print(f"\n{'='*60}")
print("📊 EVALUATION RESULTS")
print(f"{'='*60}")

intent_acc = evaluate_intent_accuracy(results)
entity_acc = evaluate_entity_accuracy(results)
hallucination_rate = check_hallucination(results)

print(f"✅ Intent Accuracy:      {intent_acc:.1%}  (target: >90%)")
print(f"📦 Entity Accuracy:      {entity_acc:.1%}  (target: >85%)")
print(f"🚫 Hallucination Rate:   {hallucination_rate:.1%}  (target: <10%)")
print(f"⚠️  Errors:              {errors}")

print(f"\n{'='*60}")
print("📋 BREAKDOWN BY INTENT")
print(f"{'='*60}")
intents = {}
for r in results:
    gt = r['ground_truth_intent']
    if gt not in intents:
        intents[gt] = {'correct': 0, 'total': 0}
    intents[gt]['total'] += 1
    if r['intent_correct']:
        intents[gt]['correct'] += 1

for intent, stats in sorted(intents.items()):
    acc = stats['correct'] / stats['total']
    bar = '█' * int(acc * 10) + '░' * (10 - int(acc * 10))
    print(f"{intent:<20} {bar} {acc:.0%} ({stats['correct']}/{stats['total']})")

failed = [r for r in results if not r['intent_correct']]
if failed:
    print(f"\n{'='*60}")
    print("❌ FAILED CASES")
    print(f"{'='*60}")
    for r in failed:
        print(f"Q: {r['question']}")
        print(f"   Expected: {r['ground_truth_intent']} | Got: {r['predicted_intent']}\n")

with open('eval_results.json', 'w') as f:
    json.dump({
        'summary': {
            'intent_accuracy': intent_acc,
            'entity_accuracy': entity_acc,
            'hallucination_rate': hallucination_rate,
            'total_cases': len(results),
            'errors': errors
        },
        'breakdown': intents,
        'failed_cases': failed
    }, f, indent=2)

print(f"\n💾 Results saved to eval_results.json")

print(f"\n{'='*60}")
print("💡 RECOMMENDATIONS")
print(f"{'='*60}")
if intent_acc >= 0.90:
    print("✅ Intent accuracy is excellent! No prompt tuning needed.")
else:
    print("⚠️  Below 90%. Fix prompt for:")
    for r in failed:
        print(f"   - '{r['question']}' → {r['ground_truth_intent']}")

if hallucination_rate <= 0.10:
    print("✅ Hallucination rate is within target (<10%)!")
else:
    print("⚠️  High hallucination. Add: 'Answer ONLY from provided context.'")