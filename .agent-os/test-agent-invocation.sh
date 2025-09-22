#!/bin/bash

# Test script to verify specialist agent invocation works

echo "=== Agent OS Specialist Invocation Test ==="
echo ""

PROJECT_ROOT="/Users/benjaminwaller/Projects/GoFast/prop-gen"
AGENT_DIR="$PROJECT_ROOT/.claude/agents"
AGENT_OS_DIR="$PROJECT_ROOT/.agent-os"

# Test 1: Check if agents exist
echo "Test 1: Checking for specialist agents..."
for agent in go-backend sveltekit-specialist cloudflare-specialist devops-engineer test-runner; do
    if [ -f "$AGENT_DIR/${agent}.md" ]; then
        echo "  ✅ Found: $agent"
    else
        echo "  ❌ Missing: $agent"
    fi
done
echo ""

# Test 2: Check registry
echo "Test 2: Checking agent registry..."
if [ -f "$AGENT_DIR/registry.yml" ]; then
    echo "  ✅ Registry exists"
    echo "  Registered agents:"
    grep "^  [a-z-]*:" "$AGENT_DIR/registry.yml" | sed 's/://;s/^/    • /'
else
    echo "  ❌ Registry missing"
fi
echo ""

# Test 3: Check invocation script
echo "Test 3: Checking invocation mechanism..."
if [ -f "$AGENT_OS_DIR/bin/invoke-specialist.sh" ]; then
    echo "  ✅ Invocation script exists"
    # Make it executable
    chmod +x "$AGENT_OS_DIR/bin/invoke-specialist.sh"
    echo "  ✅ Made executable"
else
    echo "  ❌ Invocation script missing"
fi
echo ""

# Test 4: Check instructions
echo "Test 4: Checking instruction files..."
for instruction in create-tasks execute-tasks specialist-coordination agent-invocation; do
    if [ -f "$AGENT_OS_DIR/instructions/core/${instruction}.md" ]; then
        echo "  ✅ Found: ${instruction}.md"
    else
        echo "  ❌ Missing: ${instruction}.md"
    fi
done
echo ""

# Test 5: Test invocation
echo "Test 5: Testing agent invocation..."
if [ -x "$AGENT_OS_DIR/bin/invoke-specialist.sh" ]; then
    echo "  Running test invocation..."
    "$AGENT_OS_DIR/bin/invoke-specialist.sh" go-backend "Test task" > /tmp/test-invocation.log 2>&1
    if [ $? -eq 0 ]; then
        echo "  ✅ Invocation succeeded"
        echo "  Output:"
        sed 's/^/    /' /tmp/test-invocation.log
    else
        echo "  ❌ Invocation failed"
    fi
else
    echo "  ❌ Cannot test - script not executable"
fi
echo ""

echo "=== Test Complete ==="
echo ""
echo "To manually invoke a specialist, use:"
echo "  $AGENT_OS_DIR/bin/invoke-specialist.sh [agent-name] \"[task description]\""
echo ""
echo "Or in instructions, when you see '@agent:name', load the agent from:"
echo "  $AGENT_DIR/[agent-name].md"
