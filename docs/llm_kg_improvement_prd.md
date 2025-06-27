# 360T Knowledge-Graph LLM Enhancement PRD

*Document version *: 2025-06-21 v1.0

---

## 1  Executive Summary
We regularly receive user feedback that some LLM answers are incomplete or contain hallucinated relationships. This PRD defines a **GraphRAG improvement programme** that raises factual accuracy, latency, and user satisfaction by overhauling Cypher generation, retrieval, and answer validation.

## 2  Goals & Success Criteria
| ID | Goal | Metric | Target |
|----|------|--------|--------|
| G1 | Increase factual precision | % of answers that can be fully sourced to KG docs | **+25 pp** (baseline 52 → ≥77 %) |
| G2 | Reduce query failures | Cypher parse/runtime errors per 100 questions | **< 2** |
| G3 | Cut average latency | P95 end-to-end answer time | **≤3.0 s** |
| G4 | Lower token spend | Avg. tokens sent to LLM per answer | **-20 %** |

## 3  Non-Goals
* Full UI redesign (handled by separate initiative)
* Migrating from Gemini to another LLM — we remain provider-agnostic but Gemini stays default.

## 4  User Stories
1. *As a support agent* I need reliable, sourced answers so I can copy/paste to clients without manual verification.
2. *As a quant* I want Cypher queries that finish in <200 ms so my notebooks remain reactive.
3. *As a product owner* I want instrumentation dashboards that show where answers degrade so we can react within a day.

## 5  Proposed Solution (10 Pillars)
The table maps each pillar to high-level tasks; see §6 for implementation subtasks.

| # | Pillar | Owner | Epic ID | KPI Impact |
|---|--------|-------|---------|------------|
| 1 | **Schema-Aware Prompting** | BE | KG-P-01 | G1, G2 |
| 2 | Two-Step *Plan → Write* Cypher | BE | KG-P-02 | G1, G2 |
| 3 | Guardrail & Auto-Repair | BE | KG-P-03 | G2 |
| 4 | Entity Linking Pipeline | DS | KG-P-04 | G1, G3 |
| 5 | Hybrid BM25 + Vector Retrieval | DS | KG-P-05 | G1, G3 |
| 6 | Range/Property Index Optimisation | DBA | KG-P-06 | G3 |
| 7 | Reflexive *Groundedness* Check | BE | KG-P-07 | G1 |
| 8 | Embedding-Driven Related Questions | FE | KG-P-08 | UX |
| 9 | Redis Query → Answer Cache | BE | KG-P-09 | G3, G4 |
|10 | Telemetry & Auto-Grading Loop | BE | KG-P-10 | G1, G3 |

## 6  Detailed Implementation Checklist

### KG-P-01  Schema-Aware Prompting
- [ ] **Task 1.1** Retrieve schema via `CALL db.schema.visualization()` on start-up; cache as JSON (<10 kB)
- [ ] **Task 1.2** Normalise names (`labels`, `type` → lower-snake) and strip non-alnum
- [ ] **Task 1.3** Inject _only the relevant labels & properties_ (<1 k tokens) into Cypher-gen prompt
- [ ] **Task 1.4** Unit test that prompt contains at least 3 labels when KG has >3 labels

### KG-P-02  Two-Step Cypher Generation
- [ ] **Task 2.1** Add `generate_cypher_plan()` → returns JSON list of `nodes`, `rels`, `filters`
- [ ] **Task 2.2** Add `generate_cypher_from_plan(plan)`
- [ ] **Task 2.3** Abort if plan mentions unknown label; fallback to keyword CONTAINS search
- [ ] **Task 2.4** Add pytest covering success & fallback path

### KG-P-03  Guardrail & Auto-Repair
- [ ] **Task 3.1** Implement regex linter (`MATCH`, `RETURN`, balanced parens)
- [ ] **Task 3.2** On lint failure: prompt model with `#fix` tag, temperature 0.1, max 2 retries
- [ ] **Task 3.3** Log both faulty & repaired queries to Prometheus

### KG-P-04  Entity Linking
- [ ] **Task 4.1** Run spaCy NER (en_core_web_sm) on question
- [ ] **Task 4.2** Implement fuzzy match (`apoc.text.fuzzyMatch`) to canonical node IDs
- [ ] **Task 4.3** Add unit tests: exact, fuzzy, no-match cases

### KG-P-05  Hybrid Retrieval
- [ ] **Task 5.1** Create `:Embedding` vector index via `CALL db.index.vector.create`
- [ ] **Task 5.2** Hook LangChain `Neo4jGraphVectorSearch` (K=8, λ=0.25 BM25 weight)
- [ ] **Task 5.3** A/B compare hybrid vs current: report precision@5


### KG-P-07  Reflexive Groundedness
- [ ] **Task 7.1** After final answer, call Gemini evaluator prompt; parse "yes/no"
- [ ] **Task 7.2** If "no": remove offending sentence(s) & append disclaimer blockquote

### KG-P-08  Related Questions 2.0
- [ ] **Task 8.1** Store QA embeddings in same vector index
- [ ] **Task 8.2** Return top-3 cosine neighbours (excluding current Q)
- [ ] **Task 8.3** Add Cypress e2e test that suggestions update on new query

### KG-P-09  Redis Cache
- [ ] **Task 9.1** Dockerise Redis (port 6379) with persistence
- [ ] **Task 9.2** Implement `cache.get(hash)` check before LLM call
- [ ] **Task 9.3** Add 24 h TTL eviction policy

### KG-P-10  Telemetry & Auto-Grading
- [ ] **Task 10.1** Expose `/metrics` endpoint (Flask-prometheus-metrics)
- [ ] **Task 10.2** Nightly cron: sample, grade with rubric, store CSV
- [ ] **Task 10.3** Grafana dashboard panels: precision trend, latency, token cost

## 7  Milestones & Timeline
| Phase | Duration | Deliverables |
|-------|----------|--------------|
| P0 Kick-off | 1 w | Architecture diagrams, backlog grooming |
| P1 Core (01–05) | 3 w | Schema prompt, two-step Cypher, guardrail, entity-link, hybrid search |
| P2 Perf & UX (06–08) | 2 w | Indexes, reflexive check, related Qs |
| P3 Infra & QA (09–10) | 2 w | Cache, telemetry, auto-grading, test coverage ≥90 % |
| Final QA | 1 w | Load tests, sign-off report |

## 8  Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gemini output length > 8 k tokens | M | M | Truncate schema & docs before prompt |
| Neo4j 5.x vector index still beta | L | H | Feature flag to disable hybrid search |
| Redis adds infra complexity | M | L | Use Docker compose with health checks |

## 9  Appendices
* A. Prompt templates revisions (to be tracked in `/prompts/` dir)
* B. DDL snippets for new indexes
* C. Test rubric JSON

---
© 2025 360T KG Team 