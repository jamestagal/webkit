# Spec Requirements Document

> Spec: Frontend Integration
> Created: 2025-09-25

## Overview

Connect the completed consultation domain backend APIs to the SvelteKit frontend to enable end-to-end consultation management functionality. This integration will transform the robust backend infrastructure into a user-facing application that allows agencies to create, manage, and track client consultations through an intuitive multi-step form interface.

## User Stories

### Agency User Consultation Creation

As an agency user, I want to create new client consultations through a guided multi-step form, so that I can systematically capture all necessary client information and business context for proposal generation.

The user navigates through a 4-step wizard (Contact Info → Business Context → Pain Points → Goals) with real-time validation, auto-save functionality, and the ability to save drafts and return later. Each step builds upon previous information to create a comprehensive consultation record.

### Agency User Consultation Management

As an agency user, I want to view and manage all my consultations in a centralized dashboard, so that I can track consultation status, search previous consultations, and continue working on drafts.

The user accesses a filterable list view showing all consultations with status indicators, client names, creation dates, and quick actions for editing or viewing. Advanced search and filtering capabilities help manage large volumes of consultations.

### Agency User Authentication Flow

As an agency user, I want seamless authentication that persists across browser sessions, so that I can securely access my consultation data without repeated login prompts.

The user experiences automatic JWT token refresh, secure session management, and protected routes that redirect to login when needed while preserving intended destinations.

## Spec Scope

1. **API Service Integration** - Complete connection between SvelteKit frontend and consultation backend APIs with proper error handling and type safety using existing service layer architecture.

2. **JWT Authentication Flow** - Full authentication integration including token storage, refresh, route protection, and login/logout functionality connecting to existing GoFast auth infrastructure.

3. **Multi-Step Consultation Form Integration** - Connect existing consultation form components (ClientInfoForm, BusinessContext, PainPointsCapture, GoalsObjectives, BudgetTimeline, ConsultationNotes) to backend APIs with wizard flow navigation.

4. **Component Integration & Enhancement** - Enhance existing components with Svelte 5 runes syntax and connect to consultation service APIs, including shared components (StepIndicator, ProgressBar, SaveDraft, Modal, Toast).

5. **Consultation Management Dashboard** - Implement consultation list functionality using existing UI components (Card, Button, Input, Select, Dropdown) with backend data integration.

### Existing Components Available for Reuse

**Core UI Components (47 components):**
- Form Components: Input, Select, Textarea, Button, Dropdown, Calendar, Number, PinCode
- Layout Components: Card, Modal, Toast, Tabs, Accordion, SideNavigation, Breadcrumbs
- Display Components: Badge, Chart, Timeline, ProductCard, Ratings, Spinner
- Interaction Components: Slider, ToggleButton, ThemeSwitch, ImageCropper

**Consultation Components (6 components - CREATED):**
- ClientInfoForm, BusinessContext, PainPointsCapture, GoalsObjectives, BudgetTimeline, ConsultationNotes

**Shared Workflow Components (6 components - CREATED):**
- StepIndicator, ProgressBar, SaveDraft, ErrorBoundary, LoadingStates, Modal

**Other Domain Components (20+ components - CREATED):**
- Audit: AuditRunner, AuditResults, PerformanceMetrics, IssuesList, CompetitorComparison
- Proposal: ProposalBuilder, ProposalPreview, ExecutiveSummary, CurrentState, etc.
- Package: PackageSelector, PackageComparison, FeatureList, PricingDisplay
- Analytics: ProposalMetrics, ViewTracker, ConversionChart

## Out of Scope

- Backend API modifications or new endpoint development
- Website analysis integration or PageSpeed Insights connectivity
- Proposal generation features or PDF export functionality
- Multi-tenancy or advanced user role management
- Website screenshot capture or performance audit features

## Expected Deliverable

1. **Functional Multi-Step Form** - Complete consultation creation workflow accessible at /consultations/new with all four steps working and validated.

2. **Authentication Integration** - Secure login flow that protects consultation routes and maintains session state across browser refreshes.

3. **Consultation Dashboard** - Working list view at /consultations showing all user consultations with search, filter, and management capabilities.