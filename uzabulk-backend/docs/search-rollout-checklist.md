# Search Rollout Checklist

## 1) Build Query Audit Set

- Run `npm run search:audit` in `uzabulk-backend`.
- Output file: `uzabulk-backend/tmp/search-audit-queries.json`.
- Use buckets:
  - `exact`
  - `longTail`
  - `skuOrId`
  - `typoCandidates`

## 2) Reindex With Alias Swap

- Run `npm run es:reindex:products`.
- This creates a versioned index and points alias `products` to the new index.
- Keep old index for rollback until KPI checks are complete.

## 3) KPI Targets

- API latency `searchMeta.latencyMs` p95 reduced by at least 20%.
- Top-3 relevance accuracy improved on sampled queries.
- Zero-result rate reduced.
- Query reformulation rate reduced (multiple search events in short window).

## 4) Canary Plan

- Enable new search behavior for 10% traffic.
- Compare against previous week baseline:
  - latency p50/p95
  - result count distribution
  - conversion from search sessions
- Ramp to 25%, 50%, 100% if all KPIs stay within target bounds.

## 5) Rollback

- Point alias `products` back to previous index via `esHelper.pointAliasToIndex`.
- Revert frontend debounce/cache knobs if needed.
