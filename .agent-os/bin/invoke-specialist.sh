#!/bin/bash

# Invoke specialist agents for Agent OS
# This script bridges the gap between instruction syntax and actual agent invocation

PROJECT_ROOT="/Users/benjaminwaller/Projects/GoFast/prop-gen"
AGENT_DIR="$PROJECT_ROOT/.claude/agents"
AGENT_OS_DIR="$PROJECT_ROOT/.agent-os"

# Function to invoke a specialist agent
invoke_specialist() {
    local agent_name="$1"
    local task_description="$2"
    
    echo "=== INVOKING SPECIALIST: $agent_name ==="
    echo "Task: $task_description"
    echo ""
    
    # Check if agent exists
    if [ ! -f "$AGENT_DIR/${agent_name}.md" ]; then
        echo "ERROR: Agent $agent_name not found in $AGENT_DIR"
        return 1
    fi
    
    # Create invocation record
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local invocation_file="$AGENT_OS_DIR/logs/invocations/${agent_name}-${timestamp}.md"
    
    mkdir -p "$AGENT_OS_DIR/logs/invocations"
    
    cat > "$invocation_file" << EOF
# Agent Invocation: $agent_name
Date: $(date)
Invoked By: project-manager
Task: $task_description

## Agent Definition
$(cat "$AGENT_DIR/${agent_name}.md")

## Task Context
$task_description

## Instructions for AI
Please load and act as the $agent_name specialist agent defined above.
Follow the agent's instructions and complete the requested task.
EOF
    
    echo "Agent invocation prepared at: $invocation_file"
    echo ""
    echo "TO ACTIVATE AGENT: Please load the agent definition from:"
    echo "  $AGENT_DIR/${agent_name}.md"
    echo ""
    echo "Then proceed with the task: $task_description"
}

# Export function for use in other scripts
export -f invoke_specialist

# If called directly with arguments
if [ "$#" -ge 2 ]; then
    invoke_specialist "$@"
fi
