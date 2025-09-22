---
description: How to properly invoke specialist agents in Agent OS
globs:
alwaysApply: false  
version: 1.0
encoding: UTF-8
---

# Agent Invocation Protocol

## CRITICAL: How to Actually Invoke Specialist Agents

The `@agent:agent-name` syntax in instructions is a SIGNAL to invoke an agent, but you must take these actual steps:

### Method 1: Direct Agent Loading (RECOMMENDED)

When you see an instruction like `INVOKE: @agent:go-backend`:

1. **Announce the invocation**:
   ```
   "I need to invoke the go-backend specialist agent for this task."
   ```

2. **Load the agent definition**:
   - Read the agent definition from `.claude/agents/[agent-name].md`
   - Adopt that agent's persona and expertise
   - Follow that agent's specific instructions

3. **Execute as that specialist**:
   - Work according to the specialist's patterns
   - Use the specialist's tools and approaches
   - Document work as that specialist would

### Method 2: Script-Assisted Invocation

For formal tracking, use the invoke-specialist script:

```bash
# In the project directory
.agent-os/bin/invoke-specialist.sh go-backend "Create API endpoints for user management"
```

This creates an invocation record for tracking purposes.

## Available Specialist Agents

These agents are available in `.claude/agents/`:

- **go-backend**: Backend development in Go
- **sveltekit-specialist**: Frontend with SvelteKit  
- **cloudflare-specialist**: Cloudflare services (D1, KV, R2)
- **devops-engineer**: Infrastructure and deployment
- **test-runner**: Testing and quality assurance

## When to Invoke Specialists

### During Task Creation (`/create-tasks`)

When you see Step 1 saying to consult specialists:
1. For each technology area detected in the spec
2. Load that specialist's agent definition
3. As that specialist, provide task breakdown recommendations
4. Return to project-manager role to combine inputs

### During Task Execution (`/execute-tasks`)

When you determine a task needs a specialist:
1. Identify which specialist based on task domain
2. Load that specialist's agent definition
3. Complete the task as that specialist
4. Document the completion

## Example Invocation Flow

```
User: /create-tasks

You (as project-manager):
1. "I see this spec involves Go backend and SvelteKit frontend."
2. "Let me consult the go-backend specialist first."
3. [Load .claude/agents/go-backend.md]
4. [As go-backend]: "For the backend tasks, I recommend..."
5. "Now consulting the sveltekit-specialist."
6. [Load .claude/agents/sveltekit-specialist.md]  
7. [As sveltekit-specialist]: "For the frontend tasks..."
8. [Back as project-manager]: "Combining specialist inputs into tasks.md"
```

## Common Mistakes to Avoid

❌ **DON'T**: Just write "@agent:go-backend" and continue
✅ **DO**: Actually load and act as the go-backend agent

❌ **DON'T**: Skip specialist consultation when instructed
✅ **DO**: Always invoke specialists when the instruction says to

❌ **DON'T**: Assume specialist knowledge without loading the agent
✅ **DO**: Load the agent definition to get proper context

## Verification

After any process that should have used specialists, verify:
1. Were the appropriate specialists identified?
2. Were their agent definitions loaded?
3. Did they provide their specialist input?
4. Was their input incorporated into the output?

If any of these are "no", the process was not completed correctly.
