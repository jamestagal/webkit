# GoFast CSS Addendum

**Extends**: `@standards/code-style/css-style.md`

For comprehensive TailwindCSS patterns and best practices, refer to the main CSS style guide. This addendum contains only GoFast-specific customizations and patterns.

## Project-Specific Design System

### Color System
```css
/* GoFast Brand Colors - Define in your CSS variables */
:root {
  --gofast-primary: 37 99 235;     /* Blue-600 for primary actions */
  --gofast-secondary: 16 185 129;  /* Emerald-500 for success states */
  --gofast-accent: 245 158 11;     /* Amber-500 for highlights */
  --gofast-danger: 239 68 68;      /* Red-500 for errors */
  --gofast-neutral: 71 85 105;     /* Slate-600 for text */
}

.dark {
  --gofast-primary: 96 165 250;    /* Blue-400 for dark mode */
  --gofast-secondary: 52 211 153;  /* Emerald-400 for dark mode */
  /* Adjust other colors for dark theme */
}
```

### Typography Scale
```css
/* GoFast Typography - Microservices docs & admin interfaces */
.gofast-heading-xl {
  @apply text-4xl font-bold tracking-tight text-slate-900 dark:text-white;
}

.gofast-heading-lg {
  @apply text-2xl font-semibold text-slate-800 dark:text-slate-100;
}

.gofast-body-large {
  @apply text-lg leading-relaxed text-slate-700 dark:text-slate-300;
}

.gofast-code-inline {
  @apply px-1.5 py-0.5 text-sm font-mono bg-slate-100 rounded dark:bg-slate-800;
}
```

## Component Patterns

### Service Status Indicators
```html
<!-- Microservice health status -->
<div class="flex items-center gap-2">
  <div class="h-2 w-2 rounded-full
              bg-emerald-500 dark:bg-emerald-400
              data-[status=warning]:bg-amber-500
              data-[status=error]:bg-red-500
              data-[status=unknown]:bg-slate-400"
       data-status="healthy">
  </div>
  <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
    Core Service
  </span>
</div>
```

### API Response Cards
```html
<!-- gRPC/REST endpoint documentation -->
<div class="border border-slate-200 rounded-lg overflow-hidden
            dark:border-slate-700">
  <!-- Method badge -->
  <div class="px-4 py-2 bg-slate-50 border-b border-slate-200
              dark:bg-slate-800 dark:border-slate-700">
    <div class="flex items-center gap-3">
      <span class="px-2 py-1 text-xs font-semibold rounded
                   bg-emerald-100 text-emerald-700
                   data-[method=post]:bg-blue-100 data-[method=post]:text-blue-700
                   data-[method=put]:bg-amber-100 data-[method=put]:text-amber-700
                   data-[method=delete]:bg-red-100 data-[method=delete]:text-red-700
                   dark:bg-emerald-900 dark:text-emerald-300"
            data-method="get">
        GET
      </span>
      <code class="text-sm font-mono text-slate-600 dark:text-slate-400">
        /api/v1/users
      </code>
    </div>
  </div>

  <!-- Response content -->
  <div class="p-4">
    <!-- API response content -->
  </div>
</div>
```

### Database Schema Cards
```html
<!-- PostgreSQL/SQLite table documentation -->
<div class="bg-white border border-slate-200 rounded-lg shadow-sm
            dark:bg-slate-800 dark:border-slate-700">
  <div class="px-4 py-3 border-b border-slate-200
              dark:border-slate-700">
    <h3 class="flex items-center gap-2 text-lg font-semibold text-slate-900
               dark:text-white">
      <svg class="h-5 w-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
        <!-- Database icon -->
      </svg>
      users
    </h3>
  </div>

  <div class="p-4">
    <!-- Schema fields table -->
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-xs uppercase text-slate-500 dark:text-slate-400">
          <tr class="border-b border-slate-200 dark:border-slate-700">
            <th class="py-2 text-left">Field</th>
            <th class="py-2 text-left">Type</th>
            <th class="py-2 text-left">Constraints</th>
          </tr>
        </thead>
        <!-- Table body -->
      </table>
    </div>
  </div>
</div>
```

## DaisyUI Integration Patterns

### GoFast Button Variants
```html
<!-- Primary action buttons -->
<button class="btn btn-primary
               hover:scale-105
               transition-transform duration-200">
  Deploy Service
</button>

<!-- Secondary admin actions -->
<button class="btn btn-outline btn-secondary
               hover:btn-secondary
               transition-colors duration-200">
  View Logs
</button>

<!-- Danger actions (service management) -->
<button class="btn btn-error btn-outline
               hover:btn-error
               focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
  Stop Service
</button>
```

### Admin Dashboard Cards
```html
<!-- Service metrics cards -->
<div class="card bg-base-100 shadow-md
            hover:shadow-lg
            transition-shadow duration-300">
  <div class="card-body">
    <h2 class="card-title text-slate-800 dark:text-slate-100">
      Request Rate
    </h2>
    <div class="flex items-end gap-2">
      <span class="text-3xl font-bold text-gofast-primary">
        1.2k
      </span>
      <span class="text-sm text-slate-500 mb-1">
        req/min
      </span>
    </div>
    <div class="card-actions justify-end">
      <button class="btn btn-sm btn-ghost">
        View Details
      </button>
    </div>
  </div>
</div>
```

## HTMX Integration Styles

### Live Updates
```html
<!-- Real-time service status with HTMX -->
<div class="p-4 border-l-4 border-emerald-500 bg-emerald-50
            dark:bg-emerald-900/20 dark:border-emerald-400"
     hx-get="/api/service-status"
     hx-trigger="every 5s"
     hx-swap="outerHTML">
  <div class="flex items-center gap-3">
    <div class="animate-pulse h-2 w-2 bg-emerald-500 rounded-full"></div>
    <span class="font-medium text-emerald-800 dark:text-emerald-200">
      All services operational
    </span>
  </div>
</div>

<!-- Loading states for HTMX requests -->
<div class="htmx-request:opacity-50 htmx-request:pointer-events-none
            transition-opacity duration-200">
  <!-- Content that dims during HTMX requests -->
</div>
```

## Responsive Admin Layout

### Desktop-First Admin Interface
```html
<!-- Admin dashboard layout -->
<div class="min-h-screen bg-slate-50 dark:bg-slate-900">
  <!-- Sidebar -->
  <aside class="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200
               dark:bg-slate-800 dark:border-slate-700
               hidden lg:block">
    <!-- Sidebar content -->
  </aside>

  <!-- Main content -->
  <main class="lg:ml-64">
    <!-- Header -->
    <header class="sticky top-0 z-10 bg-white border-b border-slate-200
                   dark:bg-slate-800 dark:border-slate-700">
      <div class="px-4 py-4 lg:px-8">
        <!-- Header content -->
      </div>
    </header>

    <!-- Page content -->
    <div class="p-4 lg:p-8">
      <!-- Dashboard content -->
    </div>
  </main>
</div>
```

## Performance Considerations

### Microservices UI Patterns
```html
<!-- Lazy load service details -->
<div class="service-card"
     x-data="{ loaded: false }"
     x-intersect="if (!loaded) { $nextTick(() => htmx.trigger($el, 'loadService')); loaded = true; }">
  <!-- Service card content -->
</div>

<!-- Optimize for admin dashboards -->
<div class="will-change-transform
            transform-gpu
            transition-transform duration-200
            hover:scale-105">
  <!-- Smooth animations for better UX -->
</div>
```

## GoFast-Specific Utilities

### Service Type Indicators
```css
/* Custom utilities for GoFast service types */
.service-type-core {
  @apply bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200;
}

.service-type-admin {
  @apply bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200;
}

.service-type-client {
  @apply bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200;
}

.metric-positive {
  @apply text-emerald-600 dark:text-emerald-400;
}

.metric-negative {
  @apply text-red-600 dark:text-red-400;
}
```

## Framework-Specific Notes

### SvelteKit Frontend
- Use `class:` directive for dynamic DaisyUI classes
- Leverage Svelte's reactive statements for theme switching
- Component props should accept DaisyUI variant classes

### HTMX Admin Interface
- Use `hx-indicator` classes for loading states
- Apply consistent transition classes for smooth updates
- Ensure accessibility with proper ARIA attributes

This addendum focuses on GoFast's microservices architecture, admin interfaces, and performance monitoring UIs while maintaining consistency with the main CSS style guide.