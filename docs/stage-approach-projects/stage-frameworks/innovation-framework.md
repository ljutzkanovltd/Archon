### 3.2 Innovation/Concept Development Framework

**Project Type**: Innovation/Concept Development
**Total Duration**: 1-3 weeks
**Stages**: 5
**Primary Goal**: Validate idea feasibility cheaply before full commitment

#### Stage 1: Ideation (2-3 days)

**Purpose**: Define problem and generate potential approaches

**Entry Criteria**:
- [ ] Problem statement drafted
- [ ] Stakeholder identified (who needs this?)
- [ ] Success metrics defined (how will we measure success?)

**Exit Criteria**:
- [ ] 3-5 concrete solution approaches identified
- [ ] Technical feasibility assessed for each approach
- [ ] Approach selected for prototyping
- [ ] Resource requirements estimated

**Deliverables**:
1. **Concept Document** (Markdown)
   - Problem statement (Why are we doing this?)
   - Current situation (What's the pain point?)
   - Proposed approaches (3-5 options with pros/cons)
   - Selected approach with rationale
   - Success criteria (measurable outcomes)
2. **Technical Feasibility Analysis**
   - Technical risks identified
   - Required technologies/libraries
   - Estimated complexity (Low/Med/High)
3. **Resource Requirements**
   - Estimated hours per role
   - Required skills/expertise
   - Budget estimate (if applicable)

**Allowed Agents**:
- ✅ planner (orchestration, approach generation)
- ✅ architect (technical feasibility)
- ✅ llms-expert (if AI-related)
- ✅ codebase-analyst (existing pattern analysis)
- ❌ ui-implementation-expert (too early)
- ❌ testing-expert (no code to test yet)

**Quality Gates**:
- **Must-Meet**: Problem statement clear and measurable (binary)
- **Should-Meet**: Multiple approaches explored (score ≥80/100)
- **Approval**: Automatic if quality score ≥70

**Example Tasks**:
```python
Task 1: Define problem statement and success metrics
  Assignee: planner
  Duration: 1.5 hours
  Output: Problem statement doc with SMART success criteria

Task 2: Generate 5 solution approaches
  Assignee: planner + architect (collaboration)
  Duration: 2 hours
  Output: List of approaches with pros/cons/feasibility

Task 3: Assess technical feasibility for each approach
  Assignee: architect
  Duration: 2 hours
  Dependencies: [Task 2]
  Output: Technical feasibility matrix

Task 4: Select approach and document rationale
  Assignee: planner
  Duration: 1 hour
  Dependencies: [Task 3]
  Output: Decision document with selected approach
```

#### Stage 2: Research (3-5 days)

**Purpose**: Investigate libraries, patterns, and technical details needed for prototype

**Entry Criteria**:
- [ ] Approach selected from Ideation stage
- [ ] Resources allocated (agent assignments, time)
- [ ] Research questions defined

**Exit Criteria**:
- [ ] All critical unknowns investigated
- [ ] Libraries/tools identified and evaluated
- [ ] Code examples found (≥80% coverage of features)
- [ ] Architecture sketch created

**Deliverables**:
1. **Research Report** (Markdown with code examples)
   - Libraries evaluated (with version numbers)
   - Comparison matrix (features, maturity, community)
   - Code examples for key functionality
   - Integration patterns identified
2. **Architecture Diagram** (ASCII or Mermaid)
   - System components
   - Data flow
   - Integration points
3. **Prototype Plan**
   - Features to include in prototype
   - Out-of-scope items
   - Timeline estimate

**Allowed Agents**:
- ✅ library-researcher (primary - external library research)
- ✅ codebase-analyst (existing patterns)
- ✅ llms-expert (AI/ML libraries if relevant)
- ✅ architect (architecture design)
- ❌ ui-implementation-expert (not yet implementing)
- ❌ backend-api-expert (not yet implementing)

**Quality Gates**:
- **Must-Meet**: All research questions answered (binary)
- **Should-Meet**: Code examples found for ≥80% of features (score)
- **Approval**: Automatic if score ≥70

**Example Tasks**:
```python
Task 1: Research dark mode implementation libraries
  Assignee: library-researcher
  Duration: 1.5 hours
  Output: Library comparison (react-dark-mode, next-themes, etc.)

Task 2: Find code examples for theme persistence
  Assignee: library-researcher
  Duration: 1 hour
  Dependencies: [Task 1]
  Output: Code examples (localStorage, cookies, database)

Task 3: Analyze existing design system for theme support
  Assignee: codebase-analyst
  Duration: 1.5 hours
  Output: Current design system analysis + gaps

Task 4: Create architecture diagram
  Assignee: architect
  Duration: 2 hours
  Dependencies: [Task 1, Task 2, Task 3]
  Output: ASCII diagram showing theme context, components, storage
```

#### Stage 3: Prototype (5-10 days)

**Purpose**: Build minimal working version to validate concept

**Entry Criteria**:
- [ ] Research findings reviewed and approved
- [ ] Architecture design approved
- [ ] Development environment ready

**Exit Criteria**:
- [ ] Core functionality working
- [ ] Prototype deployed to test environment
- [ ] Demo-able to stakeholders
- [ ] Technical debt documented

**Deliverables**:
1. **Working Prototype** (code repository)
   - Core features functional
   - Basic tests (not comprehensive)
   - README with setup instructions
2. **Demo Script**
   - User journey walkthrough
   - Key features to showcase
   - Known limitations
3. **Technical Debt Log**
   - Shortcuts taken for speed
   - Production requirements not met
   - Refactoring needed for scale

**Allowed Agents**:
- ✅ ui-implementation-expert (if frontend prototype)
- ✅ backend-api-expert (if backend prototype)
- ✅ database-expert (if data persistence needed)
- ✅ integration-expert (if external API involved)
- ✅ llms-expert (if AI/ML features)
- ⚠️ testing-expert (basic tests only, not rigorous)
- ❌ performance-expert (premature optimization)

**Quality Gates**:
- **Must-Meet**: Core user journey works end-to-end (binary)
- **Should-Meet**: Code quality acceptable (score ≥70/100)
- **Approval**: Manual review by Product Manager

**Example Tasks**:
```python
Task 1: Implement theme context provider
  Assignee: ui-implementation-expert
  Duration: 2.5 hours
  Output: React context for theme state management

Task 2: Create dark mode toggle component
  Assignee: ui-implementation-expert
  Duration: 2 hours
  Dependencies: [Task 1]
  Output: Toggle UI component with accessibility

Task 3: Implement theme persistence
  Assignee: backend-api-expert
  Duration: 1.5 hours
  Dependencies: [Task 1]
  Output: LocalStorage save/load + optional API sync

Task 4: Apply theme to core components
  Assignee: ui-implementation-expert
  Duration: 3 hours
  Dependencies: [Task 2, Task 3]
  Output: 5-10 components styled for dark mode

Task 5: Deploy prototype to staging
  Assignee: backend-api-expert
  Duration: 1 hour
  Dependencies: [Task 4]
  Output: Live prototype URL for demo
```

#### Stage 4: Validation (2-4 days)

**Purpose**: Test prototype with users/stakeholders to validate approach

**Entry Criteria**:
- [ ] Prototype functional and deployed
- [ ] Test participants recruited (≥5 users)
- [ ] Test script prepared

**Exit Criteria**:
- [ ] User testing completed (n≥5)
- [ ] Feedback collected and analyzed
- [ ] Decision criteria met (validate or invalidate)
- [ ] Pivot/persevere decision made

**Deliverables**:
1. **User Testing Report**
   - Participant demographics
   - Test methodology
   - Key findings (positive and negative)
   - Quotes and observations
2. **Validation Metrics**
   - Usability metrics (SUS score, task completion)
   - Performance metrics (load time, response time)
   - Business metrics (engagement, conversion)
3. **Decision Recommendation**
   - Proceed to production? (Yes/No/Pivot)
   - Required changes if pivoting
   - Estimated effort for production build

**Allowed Agents**:
- ✅ testing-expert (test planning, analysis)
- ✅ ux-ui-researcher (user testing, usability)
- ✅ performance-expert (performance validation)
- ❌ Implementation agents (no new features in validation)

**Quality Gates**:
- **Must-Meet**: User testing completed with ≥5 participants (binary)
- **Should-Meet**: User satisfaction ≥70% (score)
- **Approval**: Manual review by Product Owner + Tech Lead

**Example Tasks**:
```python
Task 1: Create user testing script
  Assignee: ux-ui-researcher
  Duration: 1 hour
  Output: Test script with scenarios, questions

Task 2: Conduct user testing sessions (5 users)
  Assignee: ux-ui-researcher + human expert
  Duration: 4 hours
  Dependencies: [Task 1]
  Output: Session notes, recordings

Task 3: Analyze feedback and create report
  Assignee: ux-ui-researcher
  Duration: 2 hours
  Dependencies: [Task 2]
  Output: User testing report with findings

Task 4: Measure performance metrics
  Assignee: performance-expert
  Duration: 1.5 hours
  Output: Performance report (load time, bundle size)

Task 5: Make proceed/pivot/kill recommendation
  Assignee: planner
  Duration: 1 hour
  Dependencies: [Task 3, Task 4]
  Output: Decision document with rationale
```

#### Stage 5: Decision Point (1 day)

**Purpose**: Make final decision on project direction

**Entry Criteria**:
- [ ] Validation results reviewed
- [ ] All stakeholders aligned

**Exit Criteria**:
- [ ] Decision made: Proceed | Pivot | Archive
- [ ] Next steps documented
- [ ] Learnings archived

**Deliverables**:
1. **Decision Document**
   - Final decision with rationale
   - Key learnings (what worked, what didn't)
   - Next steps if proceeding
   - Archive rationale if killing
2. **Handoff Package** (if proceeding)
   - Prototype code repository
   - Research findings
   - Architecture diagrams
   - Production requirements

**Allowed Agents**:
- ✅ planner (decision synthesis)
- ✅ documentation-expert (handoff documentation)
- ❌ Implementation agents (decision phase only)

**Quality Gates**:
- **Must-Meet**: Decision documented (binary)
- **Should-Meet**: Learnings captured (score ≥80)
- **Approval**: Executive approval

