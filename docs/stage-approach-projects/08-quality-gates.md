## 8. Quality Gates & Transition Criteria

### 8.1 Quality Gate Types

**Type 1: Binary Checks (Pass/Fail)**

```python
binary_gates = {
    "all_tests_passing": lambda: run_tests() == "all_pass",
    "linting_clean": lambda: run_linter() == 0,
    "coverage_adequate": lambda: get_coverage() >= 80,
    "security_clean": lambda: run_security_audit() == "no_critical"
}
```

**Type 2: Scored Criteria (0-100)**

```python
scored_gates = {
    "research_completeness": {
        "weight": 0.3,
        "threshold": 80,
        "calculate": lambda: calculate_research_score()
    },
    "design_system_compliance": {
        "weight": 0.4,
        "threshold": 90,
        "calculate": lambda: check_design_tokens_usage()
    },
    "user_satisfaction": {
        "weight": 0.3,
        "threshold": 70,
        "calculate": lambda: calculate_sus_score()
    }
}

total_score = sum(gate["weight"] * gate["calculate"]() for gate in scored_gates.values())
```

**Type 3: Manual Approval**

```python
manual_gates = {
    "stakeholder_signoff": {
        "required_approvers": ["product_manager", "design_lead"],
        "approval_method": "email",
        "timeout": "48 hours"
    }
}
```

### 8.2 Transition Criteria Matrix

| From Stage | To Stage | Must-Meet | Should-Meet (Threshold) | Approval |
|------------|----------|-----------|-------------------------|----------|
| Ideation | Research | Problem defined ✓ | Approaches explored (≥80) | Auto |
| Research | Prototype | Libraries identified ✓ | Code examples (≥70) | Auto |
| Prototype | Validation | Working demo ✓ | Features functional (≥80) | Manual (PM) |
| Wireframing | Design | Wireframes approved ✓ | Feedback addressed (≥90) | Manual (Designer) |
| Testing | Deployment | All tests passing ✓ | Performance (≥90) | Manual (Engineering Manager) |

---

