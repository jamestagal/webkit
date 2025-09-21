# Create Tasks

Create a detailed task list for implementing a feature specification.

## Description
This command analyzes a feature specification and breaks it down into executable development tasks with clear subtasks and dependencies.

## Usage
```
/create-tasks
```

## What it does
1. Reads the current feature specification
2. Analyzes technical requirements
3. Creates ordered task list with:
   - Clear task descriptions
   - Subtask breakdowns
   - Dependencies between tasks
   - Time estimates
   - Assignment suggestions

## Instructions
Full instructions are in: @.agent-os/instructions/core/create-tasks.md

## Example Output
```markdown
# Tasks for [Feature Name]

## Task 1: Setup Database Schema
- [ ] Create migration files
- [ ] Define models
- [ ] Add indexes
Dependencies: None
Estimate: 2 hours

## Task 2: Implement API Endpoints
- [ ] Create route handlers
- [ ] Add validation
- [ ] Write tests
Dependencies: Task 1
Estimate: 4 hours
```
