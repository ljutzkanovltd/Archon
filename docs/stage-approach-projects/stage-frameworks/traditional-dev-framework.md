### 3.3 Traditional Development Framework

**Project Type**: Traditional Development/Coding
**Total Duration**: 2-6 weeks
**Stages**: 5
**Primary Goal**: Deliver production-ready feature with tests and docs

#### Stage 1: Planning (2-4 days)

**Entry Criteria**:
- [ ] Requirements documented
- [ ] Acceptance criteria defined
- [ ] Team capacity confirmed

**Exit Criteria**:
- [ ] User stories written (INVEST criteria)
- [ ] Sprint backlog prioritized
- [ ] Definition of Done established
- [ ] Technical approach agreed

**Deliverables**:
1. User stories with acceptance criteria
2. Task breakdown (sprint backlog)
3. Definition of Done checklist
4. Risk register

**Allowed Agents**: planner, architect, codebase-analyst

**Quality Gates**:
- Must-Meet: Acceptance criteria clear and testable
- Should-Meet: User stories follow INVEST (score ≥90)
- Approval: Automatic

#### Stage 2: Design (3-5 days)

**Entry Criteria**:
- [ ] Planning complete
- [ ] Technical approach validated

**Exit Criteria**:
- [ ] API contracts defined (OpenAPI/GraphQL schema)
- [ ] Data models designed
- [ ] Architecture diagram created
- [ ] Design review approved

**Deliverables**:
1. API specification (OpenAPI 3.0)
2. Database schema with migrations
3. Component architecture diagram
4. Design review notes

**Allowed Agents**: architect, backend-api-expert, database-expert, ui-implementation-expert

**Quality Gates**:
- Must-Meet: API contracts complete
- Should-Meet: Design review passed (score ≥85)
- Approval: Manual (Tech Lead)

#### Stage 3: Implementation (1-4 weeks)

**Entry Criteria**:
- [ ] Design approved
- [ ] Development environment ready
- [ ] Dependencies installed

**Exit Criteria**:
- [ ] All acceptance criteria met
- [ ] Unit tests written (≥80% coverage)
- [ ] Code review passed
- [ ] Linting errors = 0

**Deliverables**:
1. Implementation code (feature branch)
2. Unit tests
3. Integration tests
4. Code review approval

**Allowed Agents**: ALL implementation agents (ui, backend, database, integration)

**Quality Gates**:
- Must-Meet: All tests passing, coverage ≥80%
- Should-Meet: Code quality score ≥85
- Approval: Automatic if gates pass

#### Stage 4: Testing (3-7 days)

**Entry Criteria**:
- [ ] Implementation complete
- [ ] Unit tests passing

**Exit Criteria**:
- [ ] E2E tests passing
- [ ] Performance benchmarks met
- [ ] Security audit clean
- [ ] QA sign-off

**Deliverables**:
1. E2E test suite
2. Performance test results
3. Security audit report
4. QA sign-off document

**Allowed Agents**: testing-expert, performance-expert

**Quality Gates**:
- Must-Meet: All tests passing, no critical bugs
- Should-Meet: Performance within 10% of targets
- Approval: Manual (QA Lead)

#### Stage 5: Deployment (1-2 days)

**Entry Criteria**:
- [ ] Testing complete
- [ ] Deployment checklist ready
- [ ] Rollback plan tested

**Exit Criteria**:
- [ ] Deployed to production
- [ ] Monitoring configured
- [ ] Documentation published
- [ ] No critical issues for 48 hours

**Deliverables**:
1. Production deployment
2. Monitoring dashboard
3. Runbook documentation
4. Release notes

**Allowed Agents**: backend-api-expert, performance-expert, documentation-expert

**Quality Gates**:
- Must-Meet: Zero-downtime deployment
- Should-Meet: Error rate <0.1% in first 48hrs
- Approval: Manual (Engineering Manager)

