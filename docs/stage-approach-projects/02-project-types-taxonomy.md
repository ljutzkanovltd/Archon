## 2. Project Types Taxonomy

### 2.1 Overview of 8 Project Types

Archon supports 8 distinct project types, each with tailored stage frameworks, agent assignments, and quality criteria. Project type classification happens automatically via the Coordinator Agent using LLM-based analysis of user requests.

**Classification Decision Tree**:
```
User Request Analysis
    │
    ├─ Contains "prototype", "experiment", "test idea"?
    │   └─ YES → INNOVATION/CONCEPT DEVELOPMENT
    │
    ├─ Contains "build feature", "add functionality", "implement"?
    │   └─ YES → TRADITIONAL DEVELOPMENT
    │
    ├─ Contains "design", "wireframe", "UI", "UX", "interface"?
    │   └─ YES → UI/UX DESIGN
    │
    ├─ Contains "API", "endpoint", "backend", "server", "database"?
    │   └─ YES → API/BACKEND DEVELOPMENT
    │
    ├─ Contains "integrate", "connect", "third-party", "webhook"?
    │   └─ YES → INTEGRATION
    │
    ├─ Contains "research", "investigate", "explore", "proof of concept"?
    │   └─ YES → RESEARCH/PROTOTYPING
    │
    ├─ Contains "AI", "ML", "model", "training", "prediction"?
    │   └─ YES → AI/ML DEVELOPMENT
    │
    └─ Contains "full application", "complete system", "end-to-end"?
        └─ YES → FULL-STACK PRODUCT
```

### 2.2 Innovation/Concept Development Projects

**Definition**: Exploratory projects focused on validating new ideas, testing hypotheses, or creating proof-of-concepts to determine feasibility before committing to full development.

**Characteristics**:
- **High Uncertainty**: Outcomes are unpredictable, pivots expected
- **Rapid Iteration**: Fast cycles of build-test-learn
- **Minimal Production Requirements**: Focus on functionality over polish
- **Learning-Oriented**: Primary goal is knowledge acquisition
- **Disposable Code**: Prototypes may be discarded after learning

**Typical Duration**: 1-3 weeks
**Risk Level**: High (30-50% may not proceed past validation)
**Failure Rate**: 40-60% (by design - validates ideas cheaply)

**Stage Sequence**:
1. **Ideation** (2-3 days) - Problem definition and approach brainstorming
2. **Research** (3-5 days) - Library research, technical feasibility
3. **Prototype** (5-10 days) - Build minimal working version
4. **Validation** (2-4 days) - Test with users or stakeholders
5. **Decision Point** (1 day) - Pivot, persevere, or archive

**Success Criteria**:
- ✅ Hypothesis validated or invalidated with evidence
- ✅ Working prototype demonstrates core concept
- ✅ Technical feasibility proven for scale-up
- ✅ Clear decision made: proceed to development OR archive
- ✅ Learnings documented for future reference

**Example Projects**:
- Testing a new UI paradigm for data visualization
- Proof-of-concept for AI-powered recommendation engine
- Experimental integration with emerging third-party API
- Validating performance of new tech stack (e.g., Rust backend)

**Agent Assignment Priority**:
- **Primary**: planner (orchestration), library-researcher (external tools), codebase-analyst (patterns)
- **Supporting**: architect (technical decisions), llms-expert (if AI-related)
- **Restricted**: testing-expert (too early for rigorous testing), documentation-expert (premature documentation)

### 2.3 Traditional Development/Coding Projects

**Definition**: Standard software development projects with well-defined requirements, established patterns, and predictable implementation paths. These are the bread-and-butter projects of most development teams.

**Characteristics**:
- **Clear Requirements**: Specifications are known upfront
- **Established Patterns**: Uses proven technical approaches
- **Predictable Timeline**: Low uncertainty in estimates
- **Production-Ready Output**: Fully tested and documented
- **Incremental Enhancement**: Builds on existing systems

**Typical Duration**: 2-6 weeks
**Risk Level**: Low-Medium (10-20% scope changes)
**Failure Rate**: <10% (well-understood work)

**Stage Sequence**:
1. **Planning** (2-4 days) - Requirements analysis, task breakdown
2. **Design** (3-5 days) - Technical design, API contracts, data models
3. **Implementation** (1-4 weeks) - Actual coding, unit tests
4. **Testing** (3-7 days) - Integration tests, E2E tests, QA
5. **Deployment** (1-2 days) - Production release, monitoring setup

**Success Criteria**:
- ✅ All acceptance criteria met
- ✅ Code coverage >80% with passing tests
- ✅ Performance benchmarks achieved (p95 latency, throughput)
- ✅ Security audit passed (no critical vulnerabilities)
- ✅ Documentation complete (API docs, README, migration guide)

**Example Projects**:
- Add pagination to user list endpoint
- Implement password reset flow with email verification
- Create admin dashboard for content moderation
- Refactor authentication service to use JWT tokens

**Agent Assignment Priority**:
- **Primary**: backend-api-expert, ui-implementation-expert, database-expert (depending on focus)
- **Supporting**: testing-expert (throughout), architect (design phase)
- **Restricted**: None (all agents may contribute)

### 2.4 UI/UX Design Projects

**Definition**: Projects primarily focused on user interface design, user experience optimization, and visual design. May include implementation or stop at design handoff.

**Characteristics**:
- **User-Centered**: Primary focus on user needs and usability
- **Visual Design**: Aesthetics and brand alignment important
- **Iterative Refinement**: Multiple rounds of feedback and revision
- **Accessibility Mandatory**: WCAG 2.1 AA compliance required
- **Design System Consistency**: Adherence to established patterns

**Typical Duration**: 1-4 weeks
**Risk Level**: Medium (25-30% revision rate based on user feedback)
**Failure Rate**: <15% (subjective, but usability testable)

**Stage Sequence**:
1. **Research & Discovery** (3-5 days) - User research, competitive analysis
2. **Information Architecture** (2-3 days) - Sitemaps, user flows
3. **Wireframing** (3-5 days) - Low-fidelity layouts
4. **Design** (5-10 days) - High-fidelity mockups, design system
5. **Prototyping** (3-5 days) - Interactive prototypes
6. **User Testing** (3-5 days) - Usability testing, iteration
7. **Handoff** (1-2 days) - Design specs, asset export, developer collaboration

**Success Criteria**:
- ✅ SUS (System Usability Scale) score >70
- ✅ WCAG 2.1 AA compliance (automated and manual audit)
- ✅ Design system compliance >95%
- ✅ Stakeholder approval obtained
- ✅ User testing validates design decisions (n≥5 users)

**Example Projects**:
- Redesign onboarding flow to reduce drop-off
- Create mobile-responsive landing page
- Design component library for design system
- Optimize checkout flow for conversion

**Agent Assignment Priority**:
- **Primary**: ux-ui-researcher (research, testing), ui-implementation-expert (prototyping, implementation)
- **Supporting**: codebase-analyst (existing patterns), architect (component architecture)
- **Restricted**: backend-api-expert (until implementation), database-expert (not design-relevant)

### 2.5 API/Backend Development Projects

**Definition**: Server-side development projects focusing on business logic, data models, API design, and backend infrastructure.

**Characteristics**:
- **Data-Centric**: Focus on data models, persistence, integrity
- **API-First**: RESTful or GraphQL endpoints as primary deliverable
- **Performance Critical**: Latency, throughput, scalability matter
- **Security-Sensitive**: Authentication, authorization, input validation
- **Documentation Required**: OpenAPI/Swagger specs mandatory

**Typical Duration**: 2-8 weeks
**Risk Level**: Medium (20-25% technical challenges)
**Failure Rate**: 10-15% (often integration issues)

**Stage Sequence**:
1. **API Design** (3-5 days) - OpenAPI spec, endpoint design
2. **Schema Design** (2-4 days) - Database schema, migrations
3. **Implementation** (1-5 weeks) - Business logic, endpoints, tests
4. **Testing & Security** (5-10 days) - Integration tests, security audit
5. **Documentation** (2-3 days) - API docs, deployment guide
6. **Deployment** (1-2 days) - Staging/production deployment

**Success Criteria**:
- ✅ All endpoints implemented per OpenAPI spec
- ✅ Response time <100ms p95 for simple queries
- ✅ OWASP Top 10 vulnerabilities addressed
- ✅ API documentation complete (Swagger UI functional)
- ✅ Database migrations backward-compatible

**Example Projects**:
- Build RESTful API for user management
- Create GraphQL API for content delivery
- Implement webhook system for event notifications
- Design and build payment processing backend

**Agent Assignment Priority**:
- **Primary**: backend-api-expert, database-expert
- **Supporting**: architect (API design), testing-expert (test strategy), integration-expert (third-party services)
- **Restricted**: ui-implementation-expert (not backend work), ux-ui-researcher (not applicable)

### 2.6 Integration Projects

**Definition**: Projects connecting Archon or related systems to external services, third-party APIs, or internal systems via APIs, webhooks, or other integration patterns.

**Characteristics**:
- **External Dependencies**: Reliant on third-party API availability
- **Documentation-Heavy**: Must understand external API docs thoroughly
- **Error Handling Critical**: Network failures, rate limits, timeouts
- **Authentication Complex**: OAuth, API keys, JWT, webhook signatures
- **Monitoring Essential**: Health checks, retry logic, alerting

**Typical Duration**: 1-3 weeks
**Risk Level**: High (30-35% due to external API complexity)
**Failure Rate**: 15-20% (often API limitations or changes)

**Stage Sequence**:
1. **Discovery** (2-3 days) - API research, documentation review
2. **API Research** (3-5 days) - Test endpoints, authentication, rate limits
3. **Integration** (5-15 days) - Implement integration, error handling
4. **Testing** (3-5 days) - End-to-end testing, edge cases
5. **Monitoring** (1-2 days) - Health checks, alerting, logging

**Success Criteria**:
- ✅ Integration functional for all documented use cases
- ✅ Error handling covers all API error codes
- ✅ Retry logic implemented with exponential backoff
- ✅ Rate limiting respected (no 429 errors)
- ✅ Monitoring alerts configured (uptime, error rate)

**Example Projects**:
- Integrate Stripe payment processing
- Connect to SendGrid for email delivery
- Implement Slack webhook notifications
- Sync data with Salesforce CRM

**Agent Assignment Priority**:
- **Primary**: integration-expert, library-researcher
- **Supporting**: backend-api-expert (API wrapper), testing-expert (edge cases)
- **Restricted**: ui-implementation-expert (unless integration has UI component)

### 2.7 Research/Prototyping Projects

**Definition**: Investigation projects exploring new technologies, patterns, or approaches without commitment to production implementation. Similar to Innovation but more focused on learning than building.

**Characteristics**:
- **Learning-First**: Primary goal is knowledge acquisition
- **Low Code Volume**: Code is exploratory, not production-quality
- **Documentation-Heavy**: Findings must be thoroughly documented
- **Time-Boxed**: Fixed duration regardless of outcomes
- **Decision Artifact**: Produces "build vs buy vs skip" recommendation

**Typical Duration**: 1-2 weeks
**Risk Level**: Medium (findings may be inconclusive)
**Failure Rate**: N/A (all outcomes valuable)

**Stage Sequence**:
1. **Literature Review** (2-3 days) - Research existing solutions, papers
2. **Experimentation** (5-10 days) - Hands-on testing, spike implementation
3. **Analysis** (2-3 days) - Evaluate findings, trade-offs
4. **Documentation** (1-2 days) - Decision document, recommendations

**Success Criteria**:
- ✅ Research question answered with evidence
- ✅ Trade-offs clearly documented (pros/cons)
- ✅ Recommendation made (build, buy, or skip)
- ✅ Code examples archived for future reference
- ✅ Learnings shared with team

**Example Projects**:
- Evaluate GraphQL vs REST for new API
- Research real-time sync solutions (WebSockets, SSE, polling)
- Investigate state management libraries for React
- Assess AI frameworks for document processing

**Agent Assignment Priority**:
- **Primary**: library-researcher, codebase-analyst
- **Supporting**: architect (evaluation criteria), documentation-expert (write-up)
- **Restricted**: testing-expert (not testing production code), performance-expert (premature optimization)

### 2.8 AI/ML Development Projects

**Definition**: Projects involving machine learning models, AI systems, training pipelines, or intelligent automation features.

**Characteristics**:
- **Data-Centric**: Quality and quantity of data critical
- **Iterative Training**: Model performance improves over iterations
- **Non-Deterministic**: Outputs are probabilistic, not deterministic
- **Compute-Intensive**: Training requires significant resources
- **Monitoring Complex**: Model drift, performance degradation over time

**Typical Duration**: 3-12 weeks
**Risk Level**: High (35-40% model performance issues)
**Failure Rate**: 20-30% (performance targets not met)

**Stage Sequence**:
1. **Problem Definition** (3-5 days) - Use case, success metrics, feasibility
2. **Data Preparation** (1-2 weeks) - Data collection, cleaning, labeling
3. **Model Development** (2-4 weeks) - Algorithm selection, training, tuning
4. **Evaluation** (5-10 days) - Performance testing, bias audit
5. **Deployment (MLOps)** (1-2 weeks) - Model serving, API wrapper
6. **Monitoring** (Ongoing) - Drift detection, retraining triggers

**Success Criteria**:
- ✅ Model performance meets business requirements (accuracy, F1, etc.)
- ✅ Inference latency <500ms p95
- ✅ Bias/fairness audit passed
- ✅ Model interpretability validated
- ✅ Monitoring dashboard operational

**Example Projects**:
- Build semantic search using embeddings
- Create content recommendation system
- Implement image classification for document processing
- Develop chatbot using RAG architecture

**Agent Assignment Priority**:
- **Primary**: llms-expert (LLM-based AI), computer-vision-expert (image/video)
- **Supporting**: backend-api-expert (model serving), database-expert (vector storage), performance-expert (optimization)
- **Restricted**: ui-implementation-expert (unless building AI UI), ux-ui-researcher (not ML work)

### 2.9 Full-Stack Product Projects

**Definition**: Comprehensive projects spanning frontend, backend, database, and deployment. Represents complete product development from concept to production.

**Characteristics**:
- **Multi-Discipline**: Requires coordination across all specialties
- **Complex Dependencies**: Frontend depends on backend, backend on database
- **Long Duration**: Typically measured in months
- **High Coordination**: Multiple agents working in parallel
- **Production-Grade**: All layers must be deployment-ready

**Typical Duration**: 4-16 weeks
**Risk Level**: High (40-50% scope evolution)
**Failure Rate**: 15-25% (often timeline or budget overruns)

**Stage Sequence**:
1. **Discovery** (1-2 weeks) - Requirements, user research, feasibility
2. **Architecture** (1-2 weeks) - System design, tech stack, infrastructure
3. **Frontend Development** (2-6 weeks) - UI components, pages, interactions
4. **Backend Development** (2-6 weeks) - APIs, business logic, data models (parallel with frontend)
5. **Integration** (1-2 weeks) - Connect frontend to backend
6. **Testing** (1-2 weeks) - E2E tests, performance tests, security audit
7. **Deployment** (3-5 days) - Production deployment, monitoring, documentation

**Success Criteria**:
- ✅ All user stories complete and accepted
- ✅ Performance targets met (page load <2s, API <100ms)
- ✅ Security audit passed (OWASP, penetration test)
- ✅ 99.9% uptime SLA achieved in first month
- ✅ User onboarding <5 minutes (time-to-value)

**Example Projects**:
- Build complete SaaS product (e.g., project management tool)
- Create e-commerce platform with payment processing
- Develop mobile-responsive web application
- Build internal admin portal with role-based access

**Agent Assignment Priority**:
- **Primary**: ALL agents may contribute depending on phase
- **Orchestration**: planner (coordinates), architect (technical decisions), project-manager-agent (task management)
- **Implementation**: ui-implementation-expert, backend-api-expert, database-expert, integration-expert (parallel work)
- **Quality**: testing-expert, performance-expert, documentation-expert (throughout)

---

