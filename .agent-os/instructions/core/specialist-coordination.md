---
description: Specialist Agent Coordination Rules for Agent OS
globs:
alwaysApply: false
version: 1.0
encoding: UTF-8
---

# Specialist Agent Coordination

## Overview

This instruction ensures proper invocation and coordination of specialist agents based on task requirements.

## Available Specialist Agents

<specialist_registry>
  go-backend:
    domain: Backend development in Go
    expertise: 
      - GoFast patterns
      - Domain modeling
      - API development
      - Database operations
      - Testing in Go
    triggers:
      - Backend service implementation
      - API endpoint creation
      - Database schema work
      - Go testing
      
  sveltekit-specialist:
    domain: Frontend development with SvelteKit
    expertise:
      - SvelteKit 5 patterns
      - Component architecture
      - Routing
      - State management
      - UI/UX implementation
    triggers:
      - Component creation
      - Route implementation
      - Frontend state management
      - UI development
      
  cloudflare-specialist:
    domain: Cloudflare services and edge computing
    expertise:
      - Workers
      - D1 database
      - KV storage
      - R2 storage
      - Edge deployment
    triggers:
      - Cloudflare service integration
      - Edge computing needs
      - CDN optimization
      
  devops-engineer:
    domain: Infrastructure and deployment
    expertise:
      - Docker
      - CI/CD pipelines
      - Kubernetes
      - Monitoring
      - Security
    triggers:
      - Deployment configuration
      - Infrastructure setup
      - Pipeline creation
      
  test-runner:
    domain: Testing and quality assurance
    expertise:
      - Unit testing
      - Integration testing
      - E2E testing
      - Test automation
    triggers:
      - Test creation
      - Test execution
      - Coverage analysis
</specialist_registry>

## Invocation Protocol

<invocation_rules>
  1. ANALYZE task requirements
  2. IDENTIFY required specialists
  3. INVOKE specialists with proper context
  4. COORDINATE multi-specialist tasks
  5. ENSURE knowledge transfer between specialists
</invocation_rules>

## Multi-Specialist Coordination

<coordination_patterns>
  fullstack_feature:
    specialists: [go-backend, sveltekit-specialist]
    coordination:
      1. go-backend creates API contract
      2. sveltekit-specialist implements UI
      3. Both coordinate on data models
      
  deployed_service:
    specialists: [go-backend, devops-engineer]
    coordination:
      1. go-backend implements service
      2. devops-engineer creates deployment
      3. Both ensure environment compatibility
      
  tested_feature:
    specialists: [go-backend, test-runner]
    coordination:
      1. test-runner defines test strategy
      2. go-backend implements with tests
      3. test-runner validates coverage
</coordination_patterns>

## Context Sharing

<context_requirements>
  ALWAYS provide to specialists:
    - Full task description
    - Relevant specifications
    - Existing code context
    - Project patterns and standards
    - Dependencies and constraints
    
  ALWAYS request from specialists:
    - Implementation following project patterns
    - Proper error handling
    - Comprehensive testing
    - Clear documentation
    - Knowledge transfer notes
</context_requirements>

## Handoff Protocol

<specialist_handoff>
  WHEN transferring between specialists:
    1. Current specialist documents work done
    2. Current specialist identifies next steps
    3. Next specialist reviews documentation
    4. Next specialist confirms understanding
    5. Coordination continues as needed
</specialist_handoff>

## Quality Gates

<quality_checks>
  BEFORE marking task complete:
    - Specialist confirms patterns followed
    - Tests are written and passing
    - Documentation is complete
    - Code review by another specialist if needed
    - Integration points verified
</quality_checks>
