# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-25-frontend-integration/spec.md

## Technical Requirements

### Svelte 5 Compliance (MANDATORY)
- **Strict Svelte 5 Runes** - Use ONLY Svelte 5 patterns: `$props()`, `$state()`, `$derived()`, `$effect()`, and `onclick={}` event handlers
- **Component Reuse Priority** - Search `/src/lib/components/` directory first, review existing component documentation, attempt to use or extend existing components before creating new ones
- **Modern Syntax Enforcement** - Forbid all Svelte 4 patterns including `export let`, `$:` reactive statements, and `on:event` handlers

### Component Architecture
- **State Management** - Use `$state()` for local component state, `$derived()` for computed values, and `$effect()` for side effects following established patterns
- **Props Handling** - Destructure props with `let { prop = 'default', class: className = '', ...restProps } = $props()` pattern
- **Form Data Structure** - Implement consistent data types: strings for text, numbers for numeric values, arrays for multi-select, booleans for checkboxes
- **Event Handlers** - Use modern `onclick`, `onsubmit`, `oninput` attributes with proper event.preventDefault() patterns

### API Service Layer
- **Centralized API Client** - Create fetch wrapper with automatic JWT token handling, request/response interceptors, and comprehensive error handling
- **TypeScript Integration** - Define complete interfaces matching backend API schemas including consultation models, form validation types, and API response structures
- **Error Response Handling** - Implement standardized error format parsing with user-friendly error messages and field-specific validation feedback

### Authentication & Security
- **JWT Token Management** - Secure token storage using httpOnly cookies, automatic refresh on 401 responses, and route protection middleware
- **Session Persistence** - Maintain authentication state across browser refreshes with proper token validation and renewal flows
- **Route Protection** - Implement server-side authentication checks in `+layout.server.ts` with redirect handling for unauthorized access

### Multi-Step Form Implementation
- **Existing Component Integration** - Connect existing consultation components (ClientInfoForm.svelte, BusinessContext.svelte, PainPointsCapture.svelte, GoalsObjectives.svelte, BudgetTimeline.svelte, ConsultationNotes.svelte) to consultation service APIs
- **Wizard Layout Enhancement** - Enhance existing consultation route layout with proper Svelte 5 runes and state management integration
- **Component Modernization** - Update existing consultation components from Svelte 4 patterns to Svelte 5 runes (`$props()`, `$state()`, `$derived()`, `onclick={}`)
- **Shared Component Integration** - Connect existing StepIndicator, ProgressBar, and SaveDraft components with proper API integration
- **State Persistence** - Use `$state()` for form data with auto-save every 30 seconds, draft recovery after page refresh, and manual save capabilities
- **Validation Integration** - Implement client-side validation using consistent error state patterns with real-time field validation and form submission validation

### UI/UX Requirements
- **TailwindCSS Patterns** - Follow established spacing: `gap-1` for label-to-input, `gap-2` for icon-to-content, `gap-6` for sections, `p-2` for standard padding
- **Responsive Design** - Use `grid grid-cols-1 lg:grid-cols-2 gap-6` for responsive layouts and `flex flex-col w-full gap-1` for form fields
- **Loading States** - Implement consistent loading patterns with `$state(false)` for loading flags and proper try/catch/finally blocks
- **Error Display** - Use red border styling for invalid inputs with `text-red-500 text-xs` error message styling

### Performance & Optimization
- **Component Lazy Loading** - Implement dynamic imports for heavy form components with proper loading state handling
- **Keyed Each Blocks** - Use `{#each items as item (item.id)}` for dynamic lists to optimize rendering performance
- **Efficient Reactivity** - Create specific dependencies in `$derived()` calculations to avoid over-reactive patterns
- **Code Splitting** - Separate consultation routes for optimized bundle size and sub-200ms page transitions

### Accessibility Standards
- **Semantic HTML** - Use proper semantic structure with `<header>`, `<nav>`, `<main>`, and `<section>` elements with appropriate ARIA labels
- **Form Accessibility** - Implement proper label-input associations, `aria-describedby` for error messages, and `aria-invalid` for validation states
- **Keyboard Navigation** - Ensure full keyboard accessibility through wizard steps with proper focus management and tab order