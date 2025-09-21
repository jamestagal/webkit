---
description: Enhanced Multi-Agent Execution Pattern for Cloudflare + SvelteKit
globs:
alwaysApply: false
version: 1.0
encoding: UTF-8
---

# Enhanced Multi-Agent Task Execution

## Overview

Execute tasks using specialized agents for Cloudflare and SvelteKit development with intelligent agent selection and parallel execution capabilities.

<pre_flight_check>
  EXECUTE: @.agent-os/instructions/meta/pre-flight.md
</pre_flight_check>

<process_flow>

<step number="1" subagent="context-fetcher" name="task_analysis">

### Step 1: Analyze Task Requirements

Determine which specialized agents are needed for the current task.

<analysis>
  <task_type>
    - Frontend only (SvelteKit)
    - Backend only (Cloudflare services)
    - Full-stack (Both)
    - Infrastructure (Deployment/Config)
  </task_type>
  
  <agent_selection>
    IF task involves Cloudflare services (D1, KV, R2):
      ASSIGN: cloudflare-specialist
    IF task involves UI components or routing:
      ASSIGN: sveltekit-specialist
    IF task involves both:
      ASSIGN: both specialists in parallel
  </agent_selection>
</analysis>

</step>

<parallel_execution optional="true">

<step number="2a" subagent="cloudflare-specialist" name="backend_implementation">

### Step 2A: Backend Implementation (Cloudflare)

Implement backend services using Cloudflare's edge platform.

<tasks>
  - Set up D1 database schema and migrations
  - Create KV namespace for caching
  - Implement R2 storage for files
  - Create API routes with proper error handling
  - Configure security headers and rate limiting
</tasks>

<logging>
  ACTION: Log all changes to .agent-os/logs/cloudflare-specialist.log
  RECORD: Database schemas created
  RECORD: KV namespaces configured
  RECORD: API endpoints implemented
</logging>

</step>

<step number="2b" subagent="sveltekit-specialist" name="frontend_implementation">

### Step 2B: Frontend Implementation (SvelteKit)

Create UI components and implement client-side functionality.

<tasks>
  - Create route structure
  - Implement components with Svelte 5 runes
  - Set up data loading patterns
  - Add form actions with validation
  - Ensure accessibility compliance
</tasks>

<logging>
  ACTION: Log all changes to .agent-os/logs/sveltekit-specialist.log
  RECORD: Components created
  RECORD: Routes implemented
  RECORD: Forms configured
</logging>

</step>

</parallel_execution>

<step number="3" subagent="project-manager" name="integration_verification">

### Step 3: Integration & Verification

Verify that frontend and backend implementations work together correctly.

<verification_checklist>
  - [ ] API routes accessible from SvelteKit
  - [ ] Platform bindings configured correctly
  - [ ] Data flows properly between services
  - [ ] Error states handled gracefully
  - [ ] Performance metrics acceptable
</verification_checklist>

<integration_tests>
  - Test data loading from D1
  - Verify KV caching works
  - Check R2 file uploads/downloads
  - Ensure forms submit correctly
  - Validate error handling
</integration_tests>

</step>

<step number="4" name="feedback_aggregation">

### Step 4: Aggregate Feedback from All Agents

Collect and summarize work performed by each specialist agent.

<feedback_collection>
  <from_agent name="cloudflare-specialist">
    - Files created/modified
    - Services configured
    - Performance optimizations applied
    - Security measures implemented
  </from_agent>
  
  <from_agent name="sveltekit-specialist">
    - Components created
    - Routes implemented  
    - State management patterns used
    - Accessibility features added
  </from_agent>
</feedback_collection>

<activity_log>
  CREATE: .agent-os/logs/task-summary-[timestamp].md
  CONTENT:
    - Task objectives
    - Agents involved
    - Work completed by each agent
    - Integration points
    - Performance metrics
    - Outstanding issues
</activity_log>

</step>

<step number="5" subagent="test-runner" name="comprehensive_testing">

### Step 5: Run Comprehensive Tests

Execute full test suite covering both frontend and backend.

<test_categories>
  <unit_tests>
    - Component tests (Vitest)
    - Utility function tests
    - API route tests
  </unit_tests>
  
  <integration_tests>
    - Data flow tests
    - Form submission tests
    - Authentication flow tests
  </integration_tests>
  
  <e2e_tests>
    - User journey tests (Playwright)
    - Cross-browser testing
    - Mobile responsiveness
  </e2e_tests>
  
  <performance_tests>
    - Lighthouse scores
    - Bundle size analysis
    - Cold start timing
    - Database query performance
  </performance_tests>
</test_categories>

</step>

<step number="6" name="documentation_update">

### Step 6: Update Documentation

Document the implementation for future reference.

<documentation_tasks>
  - Update README with new features
  - Document API endpoints
  - Create component documentation
  - Update architecture diagrams
  - Add deployment notes
</documentation_tasks>

<code_documentation>
  ```typescript
  /**
   * @module UserAuthentication
   * @description Handles user authentication using Cloudflare Workers and D1
   * @agents cloudflare-specialist, sveltekit-specialist
   * @created 2024-01-15
   */
  ```
</code_documentation>

</step>

</process_flow>

<post_flight_check>
  EXECUTE: @.agent-os/instructions/meta/post-flight.md
  
  <summary>
    ## Task Completion Summary
    
    Agents Used:
    - {list of agents involved}
    
    Work Completed:
    - {summary of changes}
    
    Files Modified:
    - {list of files}
    
    Tests Passed:
    - Unit: {count}
    - Integration: {count}
    - E2E: {count}
    
    Performance Metrics:
    - PageSpeed Score: {score}
    - Bundle Size: {size}
    - Cold Start: {time}
    
    Next Steps:
    - {recommended follow-up tasks}
  </summary>
</post_flight_check>

## Agent Communication Protocol

### Message Format
```json
{
  "from": "sveltekit-specialist",
  "to": "cloudflare-specialist",
  "type": "query",
  "payload": {
    "question": "What is the KV namespace key for user sessions?",
    "context": "Implementing logout functionality"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "correlation_id": "task-123"
}
```

### Response Format
```json
{
  "from": "cloudflare-specialist",
  "to": "sveltekit-specialist",
  "type": "response",
  "payload": {
    "answer": "Use 'session:{sessionId}' as the key pattern",
    "example": "await env.KV.delete(`session:${sessionId}`)"
  },
  "timestamp": "2024-01-15T10:30:15Z",
  "correlation_id": "task-123"
}
```

## Dynamic Agent Selection

The system can automatically select the best agent based on task requirements:

```xml
<step subagent="auto-select" requirements="database,d1,migrations">
  <!-- Automatically selects cloudflare-specialist -->
</step>

<step subagent="auto-select" requirements="component,svelte,accessibility">
  <!-- Automatically selects sveltekit-specialist -->
</step>
```

## Performance Tracking

Each agent tracks its performance metrics:

```yaml
# .agent-os/metrics/agent-performance.yml
task_123:
  cloudflare-specialist:
    start_time: "2024-01-15T10:00:00Z"
    end_time: "2024-01-15T10:15:00Z"
    duration: "15 minutes"
    files_created: 3
    files_modified: 5
    lines_added: 245
    lines_removed: 32
    
  sveltekit-specialist:
    start_time: "2024-01-15T10:00:00Z"
    end_time: "2024-01-15T10:12:00Z"
    duration: "12 minutes"
    files_created: 5
    files_modified: 2
    lines_added: 389
    lines_removed: 18
```

This enhanced execution pattern enables sophisticated multi-agent collaboration for complex full-stack development tasks.
