# Stage Frameworks

This directory contains the 8 stage-based workflow frameworks, each tailored to a specific project type.

## Overview

Each framework defines:
- **Stage Sequence**: 4-7 stages from start to completion
- **Entry/Exit Criteria**: What must be true to enter/exit each stage
- **Deliverables**: Expected outputs from each stage
- **Allowed Agents**: Which agents can work in each stage
- **Quality Gates**: Evaluation criteria for stage transitions
- **Example Tasks**: Concrete task examples per stage

## Frameworks by Project Type

### 1. [Innovation/Concept Development](./innovation-framework.md)
- **Stages**: 5 (Ideation → Research → Prototype → Validation → Decision Point)
- **Duration**: 1-3 weeks
- **Risk Level**: High (30-50% may not proceed)
- **Best For**: Exploratory projects, proof-of-concepts, validating new ideas

### 2. [Traditional Development](./traditional-dev-framework.md)
- **Stages**: 5 (Planning → Design → Implementation → Testing → Deployment)
- **Duration**: 2-6 weeks
- **Risk Level**: Low-Medium (10-20% scope changes)
- **Best For**: Standard feature development, bug fixes, enhancements

### 3. [UI/UX Design](./ui-ux-framework.md)
- **Stages**: 7 (Research → Wireframing → Design → Prototyping → User Testing → Polish → Handoff)
- **Duration**: 2-4 weeks
- **Risk Level**: Medium (20-30% iteration cycles)
- **Best For**: User interface design, user experience improvements

### 4. [API/Backend Development](./api-backend-framework.md)
- **Stages**: 6 (Requirements → Schema Design → API Design → Implementation → Testing → Documentation)
- **Duration**: 2-5 weeks
- **Risk Level**: Low-Medium (<20% scope changes)
- **Best For**: Backend API development, microservices, data integrations

### 5. [Integration Projects](./integration-framework.md)
- **Stages**: 5 (Discovery → Planning → Configuration → Testing → Deployment)
- **Duration**: 1-4 weeks
- **Risk Level**: Medium (25-35% API changes)
- **Best For**: Third-party integrations, webhooks, service-to-service

### 6. [Research/Prototyping](./research-framework.md)
- **Stages**: 4 (Problem Definition → Investigation → Synthesis → Recommendation)
- **Duration**: 1-3 weeks
- **Risk Level**: Low (outcome is knowledge, not code)
- **Best For**: Feasibility studies, technical research, library evaluation

### 7. [AI/ML Development](./ai-ml-framework.md)
- **Stages**: 6 (Data Collection → Feature Engineering → Model Training → Evaluation → Deployment → Monitoring)
- **Duration**: 3-8 weeks
- **Risk Level**: High (30-40% model underperformance)
- **Best For**: Machine learning models, AI features, predictive systems

### 8. [Full-Stack Product](./fullstack-framework.md)
- **Stages**: 7 (Discovery → Architecture → Backend → Frontend → Integration → Testing → Launch)
- **Duration**: 4-12 weeks
- **Risk Level**: High (40-50% scope evolution)
- **Best For**: Complete applications, MVPs, end-to-end products

## Selection Guide

**Use this decision tree to select the right framework**:

```
User Request Analysis
    │
    ├─ "Build feature", "Add functionality" → Traditional Development
    │
    ├─ "Design interface", "Improve UX" → UI/UX Design
    │
    ├─ "Create API", "Backend endpoint" → API/Backend Development
    │
    ├─ "Integrate with...", "Connect to..." → Integration Projects
    │
    ├─ "Research", "Investigate", "POC" → Research/Prototyping
    │
    ├─ "Test idea", "Prototype", "Experiment" → Innovation/Concept
    │
    ├─ "AI model", "ML feature", "Prediction" → AI/ML Development
    │
    └─ "Complete app", "Full system", "MVP" → Full-Stack Product
```

## Common Patterns Across Frameworks

**Early Stages** (Research, Planning, Design):
- More research-oriented agents (Tier 3)
- Lightweight quality gates
- Rapid iteration encouraged

**Middle Stages** (Implementation):
- Implementation experts (Tier 4)
- Rigorous quality gates (tests, coverage, security)
- Parallel work opportunities

**Late Stages** (Testing, Deployment, Monitoring):
- Quality assurance agents (Tier 5)
- Manual approval gates
- Documentation and handoff focus

## Related Documentation

- **[../02-project-types-taxonomy.md](../02-project-types-taxonomy.md)** - Detailed project type characteristics
- **[../04-agent-assignment-matrix.md](../04-agent-assignment-matrix.md)** - Which agents work in which stages
- **[../08-quality-gates.md](../08-quality-gates.md)** - Quality gate evaluation logic

---

**Last Updated**: 2026-01-12
**Maintainer**: SportERP Development Team
