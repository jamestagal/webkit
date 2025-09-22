---
description: Create an Agent OS tasks list from an approved feature spec
globs:
alwaysApply: false
version: 1.1
encoding: UTF-8
---

# Spec Creation Rules

## Overview

With the user's approval, proceed to creating a tasks list based on the current feature spec.

<pre_flight_check>
  EXECUTE: @.agent-os/instructions/meta/pre-flight.md
</pre_flight_check>

<process_flow>

<step number="1" subagent="project-manager" name="specialist_consultation">

### Step 1: Consult Specialist Agents

Before creating tasks, invoke relevant specialist agents based on the spec's technical requirements.

<specialist_invocation>
  ANALYZE: Review spec for technology domains
  INVOKE: Appropriate specialists based on detected technologies
  
  IF backend_work_detected (Go, API, database):
    ACTION: Load .claude/agents/go-backend.md and act as that specialist
    PROVIDE: Backend task planning following Go patterns
  
  IF frontend_work_detected (Svelte, SvelteKit, UI):
    ACTION: Load .claude/agents/sveltekit-specialist.md and act as that specialist
    PROVIDE: Frontend task planning following SvelteKit patterns
  
  IF infrastructure_work_detected (Docker, deployment):
    ACTION: Load .claude/agents/devops-engineer.md and act as that specialist
    PROVIDE: Infrastructure task planning
  
  IF cloudflare_work_detected (Workers, D1, KV):
    ACTION: Load .claude/agents/cloudflare-specialist.md and act as that specialist
    PROVIDE: Cloudflare service task planning
    
  IMPORTANT: Actually load and read these agent files to get their expertise!
</specialist_invocation>

<specialist_collaboration>
  REQUEST: Each specialist to provide:
    - Technology-specific task breakdowns
    - Best practices for their domain
    - Testing strategies
    - Common pitfalls to avoid
  COMBINE: Specialist inputs into comprehensive task list
</specialist_collaboration>

</step>

<step number="2" subagent="file-creator" name="create_tasks">

### Step 2: Create tasks.md with Specialist Input

Use the file-creator subagent to create file: tasks.md inside of the current feature's spec folder, incorporating all specialist recommendations.

<file_template>
  <header>
    # Spec Tasks
  </header>
</file_template>

<task_structure>
  <major_tasks>
    - count: 1-5
    - format: numbered checklist
    - grouping: by feature or component
  </major_tasks>
  <subtasks>
    - count: up to 8 per major task
    - format: decimal notation (1.1, 1.2)
    - first_subtask: typically write tests
    - last_subtask: verify all tests pass
  </subtasks>
</task_structure>

<task_template>
  ## Tasks

  - [ ] 1. [MAJOR_TASK_DESCRIPTION]
    - [ ] 1.1 Write tests for [COMPONENT]
    - [ ] 1.2 [IMPLEMENTATION_STEP]
    - [ ] 1.3 [IMPLEMENTATION_STEP]
    - [ ] 1.4 Verify all tests pass

  - [ ] 2. [MAJOR_TASK_DESCRIPTION]
    - [ ] 2.1 Write tests for [COMPONENT]
    - [ ] 2.2 [IMPLEMENTATION_STEP]
</task_template>

<ordering_principles>
  - Consider technical dependencies
  - Follow TDD approach
  - Group related functionality
  - Build incrementally
</ordering_principles>

</step>

<step number="3" name="execution_readiness">

### Step 3: Execution Readiness Check

Evaluate readiness to begin implementation by presenting the first task summary and requesting user confirmation to proceed.

<readiness_summary>
  <present_to_user>
    - Spec name and description
    - First task summary from tasks.md
    - Estimated complexity/scope
    - Key deliverables for task 1
  </present_to_user>
</readiness_summary>

<execution_prompt>
  PROMPT: "The spec planning is complete. The first task is:

  **Task 1:** [FIRST_TASK_TITLE]
  [BRIEF_DESCRIPTION_OF_TASK_1_AND_SUBTASKS]

  Would you like me to proceed with implementing Task 1? I will focus only on this first task and its subtasks unless you specify otherwise.

  Type 'yes' to proceed with Task 1, or let me know if you'd like to review or modify the plan first."
</execution_prompt>

<execution_flow>
  IF user_confirms_yes:
    REFERENCE: @.agent-os/instructions/core/execute-tasks.md
    FOCUS: Only Task 1 and its subtasks
    CONSTRAINT: Do not proceed to additional tasks without explicit user request
  ELSE:
    WAIT: For user clarification or modifications
</execution_flow>

</step>

</process_flow>

<post_flight_check>
  EXECUTE: @.agent-os/instructions/meta/post-flight.md
</post_flight_check>
