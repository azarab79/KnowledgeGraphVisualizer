# Hidden Links (Node2Vec + Link Prediction) Refactor & Stabilisation Plan

Acting as software-architect for Neo4j GDS integration, this document tracks every required step. Tick ☑️ items as they are completed.

---

## 1  Dev-Environment Stability

- [x] Ignore `.api.pid` in _nodemon.json_ to stop pointless restarts.
- [x] Add `prestart:clean-ports` step in `scripts/dev.js` that kills lingering processes on **3002/5177-5179**.
- [x] Confirmed **server.js** already exits cleanly on `SIGTERM` (awaits `driver.close()`).
- [x] Reduced nodemon watch scope to `src/**` & `routes/**` only (exclude `data/`, `logs/`).

## 2  Hidden-Links Pipeline Refactor

- [x] Detect GDS major version at runtime (`CALL gds.debug.sysInfo`).
- [x] Build **pipeline path** (GDS ≥ 2.2) with `gds.beta.pipeline.linkPrediction.train`.  
  _Fallback_: legacy 1.x `linkprediction.train`.
- [x] Parameterise graph projection label/config via `.env` (default `*`).
- [x] Persist trained model in DB (`gds.model.list`) & reuse if fresh (<7 days).
- [x] Stream top-_N_ predictions ≥ `threshold` back to API.

## 3  API Layer

- [x] `routes/analysis.js` – validate `topN` & `threshold` query params (celebrate).  
- [x] `GraphRepository.predictLinks()` – return array `[ {source, target, probability} ]`.
- [x] Implement caching header `Cache-Control: max-age=300`.

## 4  UI Integration

- [x] `analysisApi.js` – expose `getHiddenLinks(topN, threshold)`.
- [x] AdvancedAnalysisPanel – add toggle + slider for **threshold**.
- [x] Render result edges with dotted style on graph.

## 5  Testing

- [x] Jest unit for `GraphRepository.predictLinks()` using **neo4j-driver mock**.
- [x] Supertest integration for `/api/analysis/hidden-links` happy-path & bad params.
- [x] Playwright e2e: user loads Hidden Links, sees new dotted edges.

## 6  Performance & Observability

- [x] Metric: log execution time of each GDS call.
- [x] Add `/metrics` Prom-style endpoint exposing `hidden_links_latency_ms` histogram.

## 7  Docs & Ops

- [x] Update `README.md` with feature usage & env vars.
- [x] Provide `scripts/train_hidden_links.js` CLI for manual retrain.

---

_This checklist is living – update & tick items as we proceed._ 