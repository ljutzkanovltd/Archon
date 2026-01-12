# Archon Stage-Based Project Delivery - Quick Start Guide

**Time to Read**: 5 minutes
**Get Started**: Follow the 3-step workflow below

---

## 🎯 Core Concept (30 seconds)

Archon automatically:
1. **Classifies** your project into 1 of 8 types
2. **Selects** a stage-based workflow (4-7 stages)
3. **Assigns** specialized agents from 14 available
4. **Manages** task execution through quality gates

**You provide**: Natural language request
**Archon delivers**: Fully planned and executed project

---

## ⚡ 3-Step Workflow

### Step 1: User Describes Goal

```
User: "Build a dark mode toggle for the dashboard"
```

### Step 2: Archon Classifies & Plans

```
Coordinator Agent → Classify: UI/UX Design Project
Project Manager Agent → Select: UI/UX Framework (7 stages)
                      → Create tasks for Stage 1 (Research)
                      → Assign: ux-ui-researcher agent
```

### Step 3: Agents Execute & Transition

```
Stage 1 (Research) → Stage 2 (Wireframing) → ... → Stage 7 (Handoff)
                ↓                        ↓              ↓
         Quality Gate (Auto)      Quality Gate    Manual Approval
```

---

## 🗂️ The 8 Project Types

| Type | Duration | Complexity | When to Use |
|------|----------|------------|-------------|
| **Innovation** | 1-3 weeks | High | Test ideas, prototypes, experiments |
| **Traditional Dev** | 2-6 weeks | Low-Medium | Standard features, bug fixes |
| **UI/UX Design** | 2-4 weeks | Medium | Interface design, UX improvements |
| **API/Backend** | 2-5 weeks | Low-Medium | Backend APIs, microservices |
| **Integration** | 1-4 weeks | Medium | Third-party integrations |
| **Research** | 1-3 weeks | Low | Feasibility studies, library evaluation |
| **AI/ML** | 3-8 weeks | High | Machine learning models |
| **Full-Stack** | 4-12 weeks | High | Complete applications, MVPs |

---

## 🤖 The 14 Agents (Quick Reference)

**Tier 1 - Orchestrator**:
- `planner` - Breaks down complex work (>2 hours), assigns agents

**Tier 2 - Strategy**:
- `architect` - System design, tech stack decisions
- `llms-expert` - AI/ML features, LLM integration
- `computer-vision-expert` - Image/video processing

**Tier 3 - Research**:
- `codebase-analyst` - Find patterns in existing code
- `library-researcher` - External library research
- `ux-ui-researcher` - UX patterns, accessibility

**Tier 4 - Implementation**:
- `ui-implementation-expert` - Frontend UI components
- `backend-api-expert` - Backend APIs
- `database-expert` - Database schema, migrations
- `integration-expert` - Third-party integrations

**Tier 5 - Quality**:
- `testing-expert` - Test strategy and implementation
- `performance-expert` - Performance optimization
- `documentation-expert` - Documentation

---

## 🔄 Stage-Based Workflow Example

**Project**: Dark Mode Toggle (UI/UX Framework - 7 stages)

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Research & Discovery (2-3 days)                    │
│ Agent: ux-ui-researcher                                     │
│ Tasks: Analyze patterns, Research WCAG requirements        │
│ Quality Gate: Research completeness ≥80% (Automated)       │
└──────────────────────┬──────────────────────────────────────┘
                       ↓ PASS
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: Wireframing (1-2 days)                            │
│ Agent: ui-implementation-expert                             │
│ Tasks: Create lo-fi wireframes, Define toggle positions    │
│ Quality Gate: Stakeholder approval (Manual)                │
└──────────────────────┬──────────────────────────────────────┘
                       ↓ PASS
┌─────────────────────────────────────────────────────────────┐
│ Stage 3: Visual Design (2-3 days)                          │
│ Agent: ui-implementation-expert                             │
│ Tasks: Design light/dark themes, Color palette            │
│ Quality Gate: Design compliance ≥90% (Automated)           │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
                     ... (4 more stages)
```

**Total Duration**: ~14 days
**Agents Used**: 3 (ux-ui-researcher, ui-implementation-expert, testing-expert)
**Quality Gates**: 7 (3 automated, 4 manual approvals)

---

## 🚦 Quality Gate Types

**Type 1: Binary (Pass/Fail)**
```python
✅ All tests passing
✅ Linting clean
✅ Coverage ≥80%
```

**Type 2: Scored (0-100)**
```python
Research completeness: 85/100 (threshold: 80) → ✅ PASS
Design compliance: 92/100 (threshold: 90) → ✅ PASS
```

**Type 3: Manual Approval**
```python
Stakeholder: "Approve wireframes?" → 👍 APPROVED
            ↓
        Stage transitions to next
```

---

## 📋 Agent Selection Decision Tree

```
START
  │
  ├─ Complex (>2hr)? → YES → planner
  │                    NO ↓
  │
  ├─ System design? → architect
  ├─ AI/ML work? → llms-expert
  ├─ Images/video? → computer-vision-expert
  ├─ Find patterns? → codebase-analyst
  ├─ External library? → library-researcher
  ├─ UX research? → ux-ui-researcher
  ├─ Frontend UI? → ui-implementation-expert
  ├─ Backend API? → backend-api-expert
  ├─ Database? → database-expert
  ├─ Integration? → integration-expert
  ├─ Testing? → testing-expert
  ├─ Performance? → performance-expert
  └─ Documentation? → documentation-expert
```

---

## 🛠️ Task Validation Checklist

**Before creating tasks, verify**:
- [ ] **Estimated hours**: 0.5-4.0 hours (30 min minimum, 4 hour maximum)
- [ ] **project_id included**: CRITICAL for crash recovery
- [ ] **Agent matches task type**: Use decision tree above
- [ ] **Dependencies are logical**: No circular dependencies

**Example Valid Task**:
```python
manage_task("create",
    project_id="d80817df-6294-4e66-9b43-cbafb15da400",  # ✅ REQUIRED
    title="Research dark mode patterns",                 # ✅ Clear
    description="Analyze 5 popular apps for dark mode UX", # ✅ Specific
    assignee="ux-ui-researcher",                          # ✅ Correct agent
    estimated_hours=1.5,                                  # ✅ Valid range
    status="todo"                                         # ✅ Initial status
)
```

---

## 🚨 Common Pitfalls

| Mistake | Impact | Fix |
|---------|--------|-----|
| Skip `project_id` | Tasks orphaned on crash | ALWAYS include project_id |
| Task >4 hours | Agent timeout | Break into 2+ subtasks |
| Wrong agent | Low quality output | Use decision tree |
| Skip planner for complex work | Poor task breakdown | Use planner for >2hr work |
| Circular dependencies | Deadlock | Check dependency graph |

---

## 📖 Next Steps

1. **Deep Dive**: Read [01-platform-overview.md](./01-platform-overview.md) for architecture
2. **Understand Types**: Review [02-project-types-taxonomy.md](./02-project-types-taxonomy.md)
3. **Learn Agents**: Study [04-agent-assignment-matrix.md](./04-agent-assignment-matrix.md)
4. **See Examples**: Check [05-multi-agent-workflow.md](./05-multi-agent-workflow.md) for Python code
5. **Implementation**: Follow [10-implementation-roadmap.md](./10-implementation-roadmap.md)

---

## 🔗 Essential Links

**Documentation**:
- [Main README](./README.md) - Complete navigation guide
- [Stage Frameworks](./stage-frameworks/README.md) - All 8 frameworks

**Archon System**:
- MCP Server: `http://localhost:8051`
- Backend API: `http://localhost:8181`
- Dashboard: `http://localhost:3737`

---

## ❓ Quick FAQ

**Q: What if I'm not sure which project type?**
A: The Coordinator Agent will classify automatically. If ambiguous, it will ask clarifying questions.

**Q: Can I override agent assignments?**
A: Yes, via the planner agent, but provide justification.

**Q: What happens if an agent fails?**
A: Automatic recovery: retry with fallback LLM → reassign to different agent → escalate to human.

**Q: How long does implementation take?**
A: 10 weeks for the platform (5 phases). Individual projects: 1-12 weeks depending on type.

**Q: Can agents work in parallel?**
A: Yes! Multiple agents can work simultaneously when tasks have no dependencies.

---

**Last Updated**: 2026-01-12
**Version**: 1.0.0
**Ready to Start**: Follow the 3-step workflow above! 🚀
