# Agent OS Specialist Invocation Fix - Summary

## The Problem

The project-manager agent was not consulting specialist agents during `/create-tasks` because:

1. **Invocation syntax was not actionable**: The instructions used `@agent:agent-name` syntax, but this was just text - there was no mechanism to actually load or invoke the agents.

2. **Path mismatches**: The project-manager's discovery scripts looked for agents in `~/.agent-os/claude-code/agents/` but they actually exist in `.claude/agents/`.

3. **Unclear instructions**: The instructions said to "INVOKE" agents but didn't explain HOW to actually do this in practice.

## The Solution

### 1. Created Agent Invocation Protocol
**File**: `.agent-os/instructions/core/agent-invocation.md`

This new instruction file explicitly explains:
- How to load agent definitions from `.claude/agents/[agent-name].md`
- When to invoke specialists
- Common mistakes to avoid
- Example invocation flows

### 2. Updated create-tasks.md Instruction
**File**: `.agent-os/instructions/core/create-tasks.md`

Changed vague "INVOKE: @agent:name" to explicit:
```
ACTION: Load .claude/agents/go-backend.md and act as that specialist
PROVIDE: Backend task planning following Go patterns
```

### 3. Created Invocation Script
**File**: `.agent-os/bin/invoke-specialist.sh`

Provides a formal way to:
- Track agent invocations
- Create invocation records
- Guide the AI to load the correct agent

### 4. Created Test Script
**File**: `.agent-os/test-agent-invocation.sh`

Verifies:
- All specialist agents exist
- Registry is properly configured
- Invocation mechanism works
- Instructions are in place

## How to Use the Fixed System

### When Creating Tasks (`/create-tasks`)

1. The instruction now explicitly says to load agent files
2. When you see "consult specialists", you should:
   - Identify needed specialists based on the spec
   - Load each specialist's definition from `.claude/agents/[name].md`
   - Act as that specialist to provide input
   - Combine all specialist inputs into tasks.md

### When Executing Tasks (`/execute-tasks`)

1. For each task, determine if a specialist is needed
2. Load the appropriate specialist from `.claude/agents/[name].md`
3. Complete the task as that specialist
4. Document the work

### Manual Testing

Run the test to verify everything works:
```bash
/Users/benjaminwaller/Projects/GoFast/prop-gen/.agent-os/test-agent-invocation.sh
```

## Key Files to Reference

- **Agent Definitions**: `.claude/agents/*.md`
- **Agent Registry**: `.claude/agents/registry.yml`
- **Invocation Protocol**: `.agent-os/instructions/core/agent-invocation.md`
- **Invocation Script**: `.agent-os/bin/invoke-specialist.sh`
- **Updated Instructions**: 
  - `.agent-os/instructions/core/create-tasks.md`
  - `.agent-os/instructions/core/execute-tasks.md`

## Next Steps

When you run `/create-tasks` again:

1. The system should detect technologies in the spec
2. It should announce it's consulting specialists
3. It should load the appropriate agent definitions
4. Each specialist should provide domain-specific task recommendations
5. These should be combined into a comprehensive tasks.md

The key change is that `@agent:name` is now understood as an instruction to **actually load and act as** that agent, not just a text marker.
