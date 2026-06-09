#!/usr/bin/env python3
"""Small, dependency-free product recommender.

Input is JSON on stdin with:
  - behaviors: [{product, eventType, score, categories, name, search}]
  - candidates: [{_id, categories, name, average_rating, sold_count, date_created_utc}]

Output is JSON: {"orderedIds": ["..."]}
"""

import json
import math
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone


EVENT_WEIGHTS = {
    "view": 1.0,
    "search": 0.8,
    "add_to_cart": 5.0,
    "update_cart": 2.0,
    "checkout": 7.0,
    "order": 10.0,
}

BUY_INTENT_EVENTS = {"add_to_cart", "update_cart", "checkout", "order"}


def tokens(value):
    text = str(value or "").lower()
    return [part for part in "".join(ch if ch.isalnum() else " " for ch in text).split() if len(part) > 2]


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def recency_multiplier(value):
    created_at = parse_date(value)
    if not created_at:
        return 1.0
    now = datetime.now(timezone.utc)
    age_days = max((now - created_at).total_seconds() / 86400.0, 0.0)
    # Half-life style decay. Last few days strongly affect the next homepage visit.
    return 1.0 / (1.0 + (age_days / 7.0))


def main():
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError) as exc:
        print(json.dumps({"orderedIds": [], "error": f"stdin: {exc}"}), file=sys.stderr)
        sys.exit(1)

    behaviors = payload.get("behaviors") if isinstance(payload.get("behaviors"), list) else []
    candidates = payload.get("candidates") if isinstance(payload.get("candidates"), list) else []

    product_scores = defaultdict(float)
    category_scores = Counter()
    token_scores = Counter()
    seen_products = set()
    intent_products = set()

    for behavior in behaviors:
        if not isinstance(behavior, dict):
            continue
        weight = EVENT_WEIGHTS.get(behavior.get("eventType"), 1.0)
        weight *= float(behavior.get("score") or 1)
        weight *= recency_multiplier(behavior.get("createdAt"))
        product_id = str(behavior.get("product") or "")
        if product_id:
            product_scores[product_id] += weight
            seen_products.add(product_id)
            if behavior.get("eventType") in BUY_INTENT_EVENTS:
                intent_products.add(product_id)

        for category in behavior.get("categories") or []:
            if category:
                category_scores[str(category)] += weight

        for token in tokens(behavior.get("name")) + tokens(behavior.get("search")):
            token_scores[token] += weight

    scored = []
    for index, candidate in enumerate(candidates):
        if not isinstance(candidate, dict):
            continue
        candidate_id = str(candidate.get("_id") or "")
        score = 0.0

        # Related products get a category/name boost. Already viewed items are softened,
        # while cart/order products can still stay high because they show real intent.
        score += product_scores.get(candidate_id, 0) * (0.65 if candidate_id in intent_products else 0.08)
        score += sum(category_scores.get(str(cat), 0) for cat in candidate.get("categories") or []) * 2.2
        score += sum(token_scores.get(token, 0) for token in tokens(candidate.get("name"))) * 0.35
        score += min(float(candidate.get("average_rating") or 0), 5.0) * 0.6
        score += math.log1p(float(candidate.get("sold_count") or 0)) * 0.15
        if candidate_id in seen_products and candidate_id not in intent_products:
            score -= 3.0

        # Stable tie breaker based on candidate position from Node's rotated candidate pool.
        scored.append((score, -index, candidate_id))

    scored.sort(reverse=True)
    seen_out = set()
    out_ids = []
    for _s, _i, cid in scored:
        if cid and cid not in seen_out:
            seen_out.add(cid)
            out_ids.append(cid)

    print(json.dumps({"orderedIds": out_ids}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"orderedIds": [], "error": str(exc)}), file=sys.stderr)
        sys.exit(1)
