## 6. Integration with Existing Archon System

### 6.1 Database Schema Extensions

**New Tables Required**:

```sql
-- Table 1: Project Type Classification
CREATE TABLE archon_project_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES archon_projects(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'innovation', 'traditional_dev', 'ui_ux', 'api_backend',
        'integration', 'research', 'ai_ml', 'fullstack_product'
    )),
    framework_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id)
);

-- Table 2: Project Stages
CREATE TABLE archon_project_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES archon_projects(id) ON DELETE CASCADE,
    stage_name VARCHAR(100) NOT NULL,
    stage_order INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'skipped')),
    entry_criteria_met JSONB,
    exit_criteria_met JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: Quality Gates
CREATE TABLE archon_quality_gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES archon_project_stages(id) ON DELETE CASCADE,
    gate_type VARCHAR(50) NOT NULL CHECK (gate_type IN ('binary', 'scored', 'manual_approval')),
    criteria JSONB NOT NULL,
    result JSONB,
    passed BOOLEAN,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    approval_required BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(100),
    approved_at TIMESTAMPTZ,
    evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 4: Stage Transitions
CREATE TABLE archon_stage_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES archon_projects(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES archon_project_stages(id),
    to_stage_id UUID REFERENCES archon_project_stages(id),
    transition_type VARCHAR(50) CHECK (transition_type IN ('automatic', 'manual', 'rollback')),
    triggered_by VARCHAR(100),
    quality_gate_results JSONB,
    transition_notes TEXT,
    transitioned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced archon_tasks table
ALTER TABLE archon_tasks ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES archon_project_stages(id);
ALTER TABLE archon_tasks ADD COLUMN IF NOT EXISTS quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100);
ALTER TABLE archon_tasks ADD COLUMN IF NOT EXISTS escalated_to_human BOOLEAN DEFAULT FALSE;
ALTER TABLE archon_tasks ADD COLUMN IF NOT EXISTS human_assigned VARCHAR(100);
ALTER TABLE archon_tasks ADD COLUMN IF NOT EXISTS created_by_agent VARCHAR(100);
```

### 6.2 API Endpoints (New)

**Project Type Management**:
```python
# POST /api/v1/projects/{project_id}/classify
@router.post("/projects/{project_id}/classify")
async def classify_project(
    project_id: str,
    classification: ProjectTypeClassification
):
    """Classify project and create stage framework"""
    pass

# GET /api/v1/projects/{project_id}/type
@router.get("/projects/{project_id}/type")
async def get_project_type(project_id: str):
    """Get project type and framework info"""
    pass
```

**Stage Management**:
```python
# GET /api/v1/projects/{project_id}/stages
@router.get("/projects/{project_id}/stages")
async def get_project_stages(project_id: str):
    """Get all stages for project"""
    pass

# POST /api/v1/projects/{project_id}/stages/transition
@router.post("/projects/{project_id}/stages/transition")
async def transition_stage(
    project_id: str,
    transition: StageTransition
):
    """Transition project to next stage"""
    pass

# GET /api/v1/stages/{stage_id}/tasks
@router.get("/stages/{stage_id}/tasks")
async def get_stage_tasks(stage_id: str):
    """Get all tasks for a stage"""
    pass
```

**Quality Gates**:
```python
# POST /api/v1/stages/{stage_id}/quality-gate
@router.post("/stages/{stage_id}/quality-gate")
async def evaluate_quality_gate(
    stage_id: str,
    criteria: QualityGateCriteria
):
    """Evaluate quality gate for stage"""
    pass

# GET /api/v1/stages/{stage_id}/quality-gate
@router.get("/stages/{stage_id}/quality-gate")
async def get_quality_gate_status(stage_id: str):
    """Get current quality gate status"""
    pass
```

**Agent Assignment**:
```python
# POST /api/v1/tasks/{task_id}/assign-agent
@router.post("/tasks/{task_id}/assign-agent")
async def assign_agent_to_task(
    task_id: str,
    assignment_request: AgentAssignmentRequest
):
    """Assign optimal agent using LLM"""
    pass
```

### 6.3 MCP Tools Integration

```python
# New MCP tools for stage-based projects

@mcp.tool()
async def create_staged_project(
    title: str,
    description: str,
    project_type: Literal["innovation", "traditional_dev", "ui_ux", 
                          "api_backend", "integration", "research", 
                          "ai_ml", "fullstack_product"]
) -> dict:
    """Create new project with stage-based framework"""
    # Implementation...
    pass

@mcp.tool()
async def get_current_stage(project_id: str) -> dict:
    """Get current active stage for project"""
    pass

@mcp.tool()
async def transition_to_next_stage(
    project_id: str,
    quality_gate_override: bool = False
) -> dict:
    """Transition project to next stage with quality gate checks"""
    pass

@mcp.tool()
async def get_stage_tasks(
    project_id: str,
    stage_name: str = None
) -> dict:
    """Get tasks for specific stage or current stage"""
    pass
```

### 6.4 Backward Compatibility

**Migration Strategy for Existing Projects**:

```python
async def migrate_legacy_project_to_stages(project_id: str):
    """Migrate existing project to stage-based system"""
    
    # Step 1: Classify legacy project
    project = await get_project(project_id)
    project_type = await auto_classify_project(project)
    
    # Step 2: Create project type record
    await create_project_type(project_id, project_type)
    
    # Step 3: Infer current stage from task statuses
    tasks = await get_project_tasks(project_id)
    current_stage = infer_stage_from_tasks(tasks, project_type)
    
    # Step 4: Create stage records
    framework = STAGE_FRAMEWORKS[project_type]
    for idx, stage_name in enumerate(framework.stages):
        status = 'completed' if idx < current_stage else ('active' if idx == current_stage else 'pending')
        await create_stage(
            project_id=project_id,
            stage_name=stage_name,
            stage_order=idx,
            status=status
        )
    
    # Step 5: Link tasks to stages
    await link_tasks_to_stages(project_id, framework)
```

---

