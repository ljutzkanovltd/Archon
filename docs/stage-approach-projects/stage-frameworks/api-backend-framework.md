### 3.5 API/Backend Development Framework

**Project Type**: API/Backend Development
**Total Duration**: 2-8 weeks
**Stages**: 6
**Primary Goal**: Production-ready API with docs, tests, and monitoring

#### Stage 1: API Design (3-5 days)

**Entry Criteria**:
- [ ] Requirements clear
- [ ] Use cases documented

**Exit Criteria**:
- [ ] OpenAPI 3.0 spec complete
- [ ] Authentication strategy defined
- [ ] Rate limiting designed
- [ ] API review approved

**Deliverables**:
1. OpenAPI 3.0 specification
2. Authentication design doc
3. Rate limiting strategy
4. API review notes

**Allowed Agents**: architect, backend-api-expert

**Quality Gates**:
- Must-Meet: OpenAPI spec complete
- Should-Meet: API design follows REST best practices (score ≥90)
- Approval: Manual (API Lead)

#### Stage 2: Schema Design (2-4 days)

**Entry Criteria**:
- [ ] API design approved
- [ ] Data models identified

**Exit Criteria**:
- [ ] Database schema finalized
- [ ] Migrations written
- [ ] Indexes designed
- [ ] Schema review approved

**Deliverables**:
1. Database schema (SQL)
2. Migration scripts
3. Index strategy document
4. Schema review notes

**Allowed Agents**: database-expert, backend-api-expert

**Quality Gates**:
- Must-Meet: Schema normalized, migrations backward-compatible
- Should-Meet: Index strategy optimized (score ≥85)
- Approval: Manual (Database Lead)

#### Stage 3: Implementation (1-5 weeks)

**Entry Criteria**:
- [ ] API and schema approved
- [ ] Development environment ready

**Exit Criteria**:
- [ ] All endpoints implemented
- [ ] Business logic complete
- [ ] Unit tests ≥80% coverage
- [ ] Code review passed

**Deliverables**:
1. API implementation code
2. Unit tests
3. API documentation (Swagger UI)
4. Code review approval

**Allowed Agents**: backend-api-expert, database-expert

**Quality Gates**:
- Must-Meet: All endpoints functional, tests passing
- Should-Meet: Code quality score ≥85
- Approval: Automatic

#### Stage 4: Testing & Security (5-10 days)

**Entry Criteria**:
- [ ] Implementation complete
- [ ] Unit tests passing

**Exit Criteria**:
- [ ] Integration tests passing
- [ ] Load testing complete (1000 req/s)
- [ ] OWASP Top 10 audit clean
- [ ] Security review approved

**Deliverables**:
1. Integration test suite
2. Load test results
3. Security audit report
4. Security review sign-off

**Allowed Agents**: testing-expert, backend-api-expert

**Quality Gates**:
- Must-Meet: OWASP audit clean, load tests passing
- Should-Meet: p95 latency <100ms
- Approval: Manual (Security Team)

#### Stage 5: Documentation (2-3 days)

**Entry Criteria**:
- [ ] API functional and tested

**Exit Criteria**:
- [ ] API docs published (Swagger/Redoc)
- [ ] Integration guide written
- [ ] Example code provided
- [ ] Runbook created

**Deliverables**:
1. API documentation (Swagger UI)
2. Integration guide (Markdown)
3. Code examples (Postman collection)
4. Operations runbook

**Allowed Agents**: documentation-expert, backend-api-expert

**Quality Gates**:
- Must-Meet: API docs complete
- Should-Meet: Documentation clarity (score ≥90)
- Approval: Automatic

#### Stage 6: Deployment (1-2 days)

**Entry Criteria**:
- [ ] Testing and docs complete
- [ ] Deployment checklist ready

**Exit Criteria**:
- [ ] Deployed to production
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] No critical issues for 72 hours

**Deliverables**:
1. Production deployment
2. Monitoring dashboard (error rate, latency, throughput)
3. Alert configuration
4. Deployment post-mortem

**Allowed Agents**: backend-api-expert, performance-expert

**Quality Gates**:
- Must-Meet: Deployment successful, monitoring active
- Should-Meet: Error rate <0.1%
- Approval: Manual (DevOps Lead)

---


