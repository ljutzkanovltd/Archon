# Best Practices - Archon Knowledge Base

Industry standards and best practices for MCP protocol, knowledge base management, and task management in Archon.

---

## MCP Protocol Standards

### Protocol Compliance

**Standards:**
- Follow MCP specification from https://modelcontextprotocol.io/
- Implement standard capabilities (search, retrieve, index)
- Support JSON-RPC 2.0 for all MCP communication
- Provide clear method documentation for all MCP tools
- Handle errors gracefully with descriptive error messages

### Security Requirements

**Authentication & Authorization:**
- Authentication required for sensitive operations (create, update, delete)
- Use service keys for admin operations
- Implement API key rotation policies
- Never expose credentials in logs or responses

**Rate Limiting:**
- Rate limiting for public endpoints (prevent abuse)
- Implement exponential backoff for retries
- Monitor API usage patterns

**Input/Output Validation:**
- Input validation for all API parameters
- Output sanitization to prevent injection attacks
- Schema validation for JSON payloads

---

## Knowledge Base Management

### Document Organization

**Best Practices:**

1. **Clear Hierarchy**
   - Organize docs by project → category → topic
   - Use consistent directory structure
   - Maintain logical parent-child relationships

2. **Consistent Naming**
   - Use kebab-case for file names (e.g., `api-patterns.md`)
   - Descriptive names that reflect content
   - Avoid abbreviations unless industry-standard

3. **Metadata Tagging**
   - Tag documents with relevant keywords
   - Include project, category, and topic tags
   - Use tags for cross-referencing

4. **Version Tracking**
   - Track document versions in `archon_document_versions` table
   - Include change summaries for each version
   - Support rollback to previous versions

### Indexing Practices

**Best Practices:**

1. **Regular Reindexing**
   - Schedule weekly full reindex
   - Trigger reindex after bulk document changes
   - Monitor index health and performance

2. **Incremental Updates**
   - Index new documents immediately
   - Update existing documents on change
   - Remove deleted documents from index

3. **Content Deduplication**
   - Detect duplicate content before indexing
   - Merge similar documents
   - Maintain canonical document references

4. **Efficient Search Algorithms**
   - Use pgvector for semantic search
   - Implement full-text search with PostgreSQL
   - Optimize queries with proper indexing

### Search Optimization

**Best Practices:**

1. **Full-Text Search** (for keywords)
   - Use PostgreSQL `tsvector` and `tsquery`
   - Implement stemming and stop-word removal
   - Support phrase search and wildcards

2. **Semantic Search** (for concepts)
   - Use pgvector with OpenAI/Azure embeddings
   - Implement similarity-based ranking
   - Support hybrid search (text + semantic)

3. **Filter and Faceting**
   - Allow filtering by project, category, tags
   - Support date range filtering
   - Implement faceted navigation

4. **Relevance Ranking**
   - Combine text and semantic scores
   - Boost recent documents
   - Personalize results based on user context

---

## Task Management

### Task Creation

**Best Practices:**

1. **Clear, Actionable Titles**
   - Use verb + noun format (e.g., "Implement JWT authentication")
   - Be specific and concise (5-10 words)
   - Avoid ambiguous language

2. **Detailed Descriptions**
   - Include acceptance criteria
   - List required resources
   - Define success metrics
   - Link to relevant documentation

3. **Appropriate Priority**
   - Use priority levels: low, medium, high, urgent
   - Align with project roadmap
   - Consider dependencies and blockers

4. **Relevant Tags**
   - Tag with feature area (e.g., "backend", "api")
   - Include technology tags (e.g., "fastapi", "react")
   - Use status tags for tracking

### Status Management

**Best Practices:**

1. **Keep Status Updated**
   - Update status as work progresses
   - Use standard workflow: todo → in_progress → review → done
   - Document status transitions

2. **Track Progress**
   - Use progress percentages or checkpoints
   - Update completion estimates
   - Log time spent on tasks

3. **Monitor Blockers**
   - Mark tasks as "blocked" when stuck
   - Document blocker reasons
   - Escalate blockers promptly

4. **Review Regularly**
   - Weekly task review meetings
   - Monthly backlog grooming
   - Quarterly roadmap planning

### Task Organization

**Best Practices:**

1. **Group by Project**
   - Organize tasks by project ID
   - Use project-specific workflows
   - Maintain project boundaries

2. **Use Tags Effectively**
   - Consistent tag taxonomy
   - Tag-based filtering and reporting
   - Tag hierarchies for complex projects

3. **Set Due Dates**
   - Set realistic due dates
   - Account for dependencies
   - Buffer for unexpected delays

4. **Assign Ownership**
   - Clear task ownership
   - Distribute workload evenly
   - Track team capacity

---

## Development Workflow

### Git Best Practices

**Branching:**
- Use feature branches for all changes
- Name branches: `feature/task-id-short-description`
- Keep branches short-lived (< 1 week)

**Commits:**
- Use conventional commit messages: `type(scope): subject`
- Types: feat, fix, docs, style, refactor, test, chore
- Reference task IDs in commit messages

**Pull Requests:**
- One PR per task
- Include task description and acceptance criteria
- Request reviews from relevant team members
- Ensure CI/CD passes before merging

### Code Review

**Review Checklist:**
- [ ] Code follows project conventions
- [ ] Tests cover new functionality
- [ ] Documentation updated
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed

### Testing

**Test Coverage:**
- Unit tests: 80% coverage minimum
- Integration tests: Critical paths
- E2E tests: User workflows

**Test Organization:**
- Tests in `tests/` directory
- Mirror source code structure
- Use descriptive test names

---

## Security Best Practices

### API Security

1. **Authentication**
   - Require authentication for all write operations
   - Use JWT tokens with expiration
   - Implement refresh token rotation

2. **Authorization**
   - Role-based access control (RBAC)
   - Resource-level permissions
   - Audit logging for sensitive operations

3. **Input Validation**
   - Validate all input parameters
   - Sanitize user-provided content
   - Prevent SQL injection and XSS

### Database Security

1. **Connection Security**
   - Use SSL/TLS for database connections
   - Rotate database credentials regularly
   - Limit database user permissions

2. **Data Protection**
   - Encrypt sensitive data at rest
   - Use prepared statements (prevent SQL injection)
   - Implement row-level security (RLS) if needed

3. **Backup Security**
   - Encrypt backup files
   - Store backups in secure location
   - Test restore procedures regularly

---

## Performance Optimization

### Database Optimization

1. **Indexing**
   - Create indexes on frequently queried columns
   - Use partial indexes for filtered queries
   - Monitor index usage and remove unused indexes

2. **Query Optimization**
   - Use `EXPLAIN ANALYZE` to profile queries
   - Avoid N+1 query problems
   - Implement query caching

3. **Connection Pooling**
   - Use connection pools (e.g., pgbouncer)
   - Configure appropriate pool size
   - Monitor connection usage

### API Optimization

1. **Caching**
   - Cache frequently accessed data
   - Use ETags for conditional requests
   - Implement cache invalidation strategies

2. **Pagination**
   - Paginate large result sets
   - Use cursor-based pagination for stability
   - Set reasonable page size limits

3. **Rate Limiting**
   - Implement rate limiting per API key
   - Use sliding window algorithm
   - Return appropriate HTTP status codes (429)

---

## Monitoring & Observability

### Logging

**Best Practices:**
- Structured logging (JSON format)
- Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
- Include request IDs for tracing
- Avoid logging sensitive data

**Log Aggregation:**
- Centralized log collection
- Log retention policies (30-90 days)
- Log rotation and compression

### Metrics

**Key Metrics:**
- API response times (p50, p95, p99)
- Request rates and error rates
- Database query performance
- Resource utilization (CPU, memory, disk)

**Monitoring Tools:**
- Application metrics (Prometheus, Grafana)
- Database monitoring (pg_stat_statements)
- Log analysis (ELK stack, Loki)

### Alerting

**Alert Rules:**
- Error rate > 5%
- Response time p95 > 500ms
- Database connection pool exhaustion
- Disk usage > 80%

**Alert Channels:**
- Email for low-priority alerts
- Slack/PagerDuty for high-priority alerts
- Escalation policies for critical alerts

---

## Agentic Workflow Best Practices

### Task Validation Procedures

**Scope Validation Checklist:**
- [ ] Estimated hours: 0.5 - 4.0 (30 min minimum, 4 hour maximum)
- [ ] Single responsibility (one clear, focused goal)
- [ ] Concrete acceptance criteria defined
- [ ] No external blockers or dependencies on unavailable resources

**Agent Assignment Validation:**
- [ ] Task type matches agent expertise (see Agent Assignment Matrix in CLAUDE.md)
- [ ] Agent has access to required tools and permissions
- [ ] Dependencies assigned to appropriate agents
- [ ] `assignee` field populated with correct agent name
- [ ] `created_by_agent` field set if created by planner

**Planning Validation** (for planner agent):
- [ ] Complex work (>2hr total) assigned to planner first
- [ ] Planner has created breakdown before implementation starts
- [ ] All subtasks have `estimated_hours` set
- [ ] Dependency order is logical and acyclic
- [ ] Each subtask includes `project_id` for crash recovery

**Crash Recovery Validation:**
- [ ] **CRITICAL**: ALL tasks include `project_id` parameter
- [ ] Project exists before task creation
- [ ] `project_id` is valid UUID from Archon
- [ ] Tasks can be recovered via `find_tasks(project_id=...)`

### Agent Assignment Best Practices

**Decision Process:**
1. Check complexity: >2hr or unknown scope → Use **planner** first
2. Match task type to agent expertise (see quick reference)
3. Verify agent availability and capacity
4. Assign dependencies to appropriate sequential agents
5. Include `project_id` on all tasks for crash recovery

**Common Mistakes to Avoid:**
- ❌ Assigning complex multi-step work directly to implementation experts (bypass planner)
- ❌ Creating tasks without `project_id` (orphaned tasks on crash)
- ❌ Exceeding 4-hour task scope (break down further)
- ❌ Creating circular dependencies between tasks
- ❌ Assigning tasks to invalid or non-existent agents

**Agent Utilization Tips:**
- Use planner for all >2hr work to ensure proper breakdown
- Leverage researcher agents before implementation (library-researcher, ux-ui-researcher)
- Parallel execution: Assign independent tasks to different agents simultaneously
- Sequential execution: Use dependencies for tasks requiring prior completion

### Common Agent Combinations

| Scenario | Agent Sequence | Duration |
|----------|----------------|----------|
| **New Feature (Complex)** | planner → architect → ui-expert + backend-expert → testing-expert → docs-expert | 12-16 hr |
| **New Feature (Simple)** | ui-expert OR backend-expert → testing-expert | 4-6 hr |
| **AI/ML Integration** | planner → llms-expert + backend-expert → testing-expert → performance-expert | 10-14 hr |
| **Third-Party Integration** | library-researcher → integration-expert → testing-expert | 5-8 hr |
| **Database Migration** | architect → database-expert → testing-expert | 6-9 hr |
| **Performance Issue** | performance-expert → (optional: database-expert OR ui-expert) | 2-5 hr |
| **Bug Fix (Simple)** | Direct to expert (backend/ui/database) | 0.5-2 hr |
| **Bug Fix (Complex)** | planner → codebase-analyst → expert → testing-expert | 4-6 hr |
| **UX Improvement** | ux-ui-researcher → ui-expert → testing-expert | 5-8 hr |
| **Computer Vision** | planner → computer-vision-expert + backend-expert → performance-expert | 10-12 hr |

**Usage Patterns:**
- **Research-first**: library-researcher or ux-ui-researcher before implementation
- **Architecture-first**: architect before complex implementations
- **Quality-last**: Always end with testing-expert, optionally performance-expert and documentation-expert

### Project Archival Best Practices

**When to Archive:**
- ✅ Project completed and no longer active
- ✅ Project on indefinite hold (>30 days)
- ✅ Declutter active projects list (quarterly cleanup)
- ✅ Historical record needed but not daily access

**When NOT to Archive:**
- ❌ Tasks might resume within 30 days
- ❌ Active development ongoing
- ❌ Frequent reference needed

**Archival Workflow:**
```python
# Step 1: Review completion stats
stats = get_completion_stats(project_id="project-123")
print(f"Completion: {stats['stats']['completion_rate']}%")

# Step 2: Archive (soft delete)
archive_project(project_id="project-123", archived_by="Admin")

# Step 3: Verify (archived hidden by default)
projects = list_projects()  # Active only
all_projects = list_projects(include_archived=True)  # All

# Step 4: Restore if needed
unarchive_project(project_id="project-123")
```

**Task History Management:**
- 🗄️ History retained indefinitely for archived projects
- 🔒 History is immutable (audit trail integrity)
- 📊 Use field filtering for focused analysis (`field_name` parameter)
- 🚀 Paginate large histories with `limit` parameter

**Completion Tracking:**
- 📈 Monitor completion rates to identify bottlenecks
- ⏱️ Track `avg_completion_time_hours` to improve estimates
- 📊 Weekly velocity tracking (7-day windows)
- 🎯 Use metrics for sprint planning and capacity estimation

---

**Related Documentation**:
- Main CLAUDE.md: `@.claude/CLAUDE.md`
- Agentic Workflow: `@.claude/docs/AGENTIC_WORKFLOW.md`
- MCP Integration: Main CLAUDE.md, MCP Integration section
- Task Management: Main CLAUDE.md, Task Management section
- Security: This document, Security Best Practices section
