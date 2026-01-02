# Archon Documentation

This directory contains all documentation for the Archon knowledge base and task management system.

## Directory Structure

```
docs/
├── setup/              # Installation & configuration guides
├── architecture/       # System design & infrastructure
├── operations/         # Backups, disaster recovery, maintenance
├── testing/            # QA reports & testing documentation
├── features/           # Feature documentation & guides
├── planning/           # Project planning & roadmaps
├── development/        # Development workflows & contribution guides
├── changelog/          # Historical fixes & completed work
├── accessibility/      # WCAG compliance & accessibility audits
├── archon-ui-nextjs/   # Next.js UI documentation
├── onboarding/         # Onboarding materials
└── tasks/              # Task-specific documentation
```

## Quick Navigation

### Getting Started
- [Installation Guide](setup/INSTALLATION.md)
- [LLM Configuration](setup/LLM_CONFIGURATION_GUIDE.md)
- [Ollama Quickstart](setup/OLLAMA_QUICKSTART.md)

### Configuration
| Provider | Documentation |
|----------|--------------|
| Ollama | [Configuration](setup/OLLAMA_CONFIGURATION_SUMMARY.md), [Test Results](setup/OLLAMA_CONFIGURATION_TEST_RESULTS.md) |
| Azure OpenAI | [Implementation](setup/AZURE_OPENAI_IMPLEMENTATION.md), [Configuration](setup/azure_openai_configuration.md) |
| Multi-Provider | [Centralized Provider Configuration](setup/CENTRALIZED_PROVIDER_CONFIGURATION.md) |

### Architecture
- [Network Architecture & Database Connection](architecture/NETWORK_ARCHITECTURE_AND_DATABASE_CONNECTION.md)
- [Database Migration (2025-12)](architecture/DATABASE_MIGRATION_2025-12.md)

### Operations
- [Backups](operations/BACKUPS.md)
- [Disaster Recovery](operations/DISASTER_RECOVERY.md)
- [Data Retention Policy](operations/DATA_RETENTION_POLICY.md)
- [Troubleshooting & Startup Fixes](operations/TROUBLESHOOTING_STARTUP_FIXES.md)

### Features
- [Features & Usage Guide](features/FEATURES_AND_USAGE.md)
- [Agents Documentation](features/AGENTS.md)

### Development
- [Git Workflow](development/GIT_WORKFLOW.md)
- [Claude Integration](development/CLAUDE.md)

### Testing & QA
- [Testing Guide](testing/TESTING_GUIDE.md)
- [QA Reports](testing/) - Phase 2 component testing, active users widget, etc.

### Planning
- [2025 Q1 Improvement Strategy](planning/IMPROVEMENT_STRATEGY_2025Q1.md)
- [Agent Work Orders Project Plan](planning/AGENT_WORK_ORDERS_PROJECT_PLAN.md)
- [Action Menu Refactor Plan](planning/ACTION_MENU_REFACTOR_PLAN.md)
- [Archon Project Prompt](planning/ARCHON_PROJECT_PROMPT.md)

### Accessibility
- [WCAG 2.1 AA Audit](accessibility/WCAG_2.1_AA_ACCESSIBILITY_AUDIT.md)

### Changelog
Historical documentation of fixes and completed features:
- Azure OpenAI fixes (crawling, settings persistence, deployment)
- Ollama crawling fixes
- RAG settings fixes
- Dashboard investigations
- Token tracking implementation

See [changelog/](changelog/) for the complete list.

## Related Documentation

- **Main Project**: See root [README.md](../README.md)
- **Claude Code Integration**: See [.claude/CLAUDE.md](../.claude/CLAUDE.md)
- **API Reference**: See [.claude/docs/API_REFERENCE.md](../.claude/docs/API_REFERENCE.md)
