# Agent OS Specialist Invocation Reference Card

## When Specialists Are Invoked

### 1. During `/create-tasks`
**Step 1: Specialist Consultation**
- Detects technologies in spec
- Loads relevant specialist agents
- Each specialist provides task planning for their domain
- Inputs combined into comprehensive tasks.md

### 2. During `/execute-task` (single task)
**Step 2: Specialist Agent Assignment**
- Analyzes task requirements
- Loads appropriate specialist based on domain:
  - Go/API/Backend → go-backend
  - Svelte/UI/Frontend → sveltekit-specialist
  - Docker/CI/CD → devops-engineer
  - Cloudflare/D1/KV → cloudflare-specialist
  - Testing → test-runner
- Specialist executes the task following their patterns

### 3. During `/execute-tasks` (multiple tasks)
**Delegates to `/execute-task` for each**
- Loops through assigned tasks
- Each task gets specialist assignment via execute-task
- Specialists handle their domain tasks

## How Invocation Actually Works

### ❌ OLD (Broken) Way
```
INVOKE: @agent:go-backend
```
This was just text - nothing actually happened!

### ✅ NEW (Working) Way
```
ACTION: Load .claude/agents/go-backend.md and act as that specialist
EXECUTE: Task as go-backend specialist following Go patterns
```

## Quick Reference - Specialist Domains

| Specialist | Triggers | Responsibilities |
|------------|----------|------------------|
| **go-backend** | Go code, APIs, backend services, domain models | Backend implementation following GoFast patterns |
| **sveltekit-specialist** | Svelte components, UI, routes, frontend state | Frontend implementation with SvelteKit 5 |
| **cloudflare-specialist** | D1, KV, R2, Workers, edge functions | Cloudflare service integration |
| **devops-engineer** | Docker, deployment, CI/CD, infrastructure | Infrastructure and deployment setup |
| **test-runner** | Test creation, test execution, coverage | Testing strategy and implementation |

## Manual Invocation

### In Commands
When you see instructions to invoke a specialist:
1. Load the agent file: `.claude/agents/[specialist-name].md`
2. Adopt that agent's persona and expertise
3. Complete the task as that specialist
4. Document work following specialist patterns

### Via Script (for tracking)
```bash
.agent-os/bin/invoke-specialist.sh go-backend "Create user API endpoints"
```

## Verification Checklist

After any command that should use specialists:
- [ ] Were specialists identified based on task requirements?
- [ ] Were agent definitions actually loaded?
- [ ] Did specialists provide their domain expertise?
- [ ] Was specialist input incorporated into output?

## Common Patterns

### Full-Stack Feature
1. go-backend creates API contract
2. sveltekit-specialist implements UI
3. Both coordinate on data models

### Cloudflare Integration
1. cloudflare-specialist sets up services
2. go-backend integrates with backend
3. sveltekit-specialist adds UI controls

### Tested Implementation
1. test-runner defines test strategy
2. Domain specialist implements with tests
3. test-runner validates coverage

## File Locations

- **Agent Definitions**: `.claude/agents/*.md`
- **Registry**: `.claude/agents/registry.yml`
- **Invocation Protocol**: `.agent-os/instructions/core/agent-invocation.md`
- **Test Script**: `.agent-os/test-agent-invocation.sh`
