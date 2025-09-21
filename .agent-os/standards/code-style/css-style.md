# CSS Style Guide - Tailwind CSS Style Guide for LLM Development

We always use the latest version of TailwindCSS for all CSS.

## Core Principles

### 1. Multi-line Class Organization

Organize Tailwind classes across multiple lines for better readability and maintenance. Each line should represent a logical grouping or responsive breakpoint.

**Structure Order:**
```html
<div class="[base-layout] [typography] [colors] [borders/effects]
            [hover-states]
            [focus-states]
            [dark-mode-variants]
            sm:[small-screen-overrides]
            md:[medium-screen-overrides]
            lg:[large-screen-overrides]
            xl:[extra-large-overrides]
            2xl:[2xl-overrides]">
  Content
</div>
```

**Example:**
```html
<button class="px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg shadow-md
               hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5
               focus:outline-none focus:ring-4 focus:ring-blue-300
               dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800
               sm:px-6 sm:py-3 sm:text-base
               lg:px-8 lg:py-4 lg:text-lg
               transition-all duration-200 ease-in-out">
  Click me
</button>
```

### 2. Class Grouping Strategy

Group related utilities together on the same line for logical organization:

```html
<!-- Good: Grouped by concern -->
<div class="flex flex-col items-center justify-between gap-4
            w-full max-w-4xl mx-auto px-6 py-8
            text-gray-800 font-medium text-lg leading-relaxed
            bg-white border border-gray-200 rounded-xl shadow-sm
            hover:shadow-md hover:border-gray-300
            dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
```

**Grouping Categories:**
- **Layout**: `flex`, `grid`, `block`, `inline`, positioning
- **Spacing**: `p-*`, `m-*`, `space-*`, `gap-*`
- **Sizing**: `w-*`, `h-*`, `min-*`, `max-*`
- **Typography**: `font-*`, `text-*`, `leading-*`, `tracking-*`
- **Colors**: `text-*`, `bg-*`, `border-*`
- **Effects**: `shadow-*`, `opacity-*`, `blur-*`
- **Transitions**: `transition-*`, `duration-*`, `ease-*`
- **States**: `hover:*`, `focus:*`, `active:*`, `disabled:*`

### 3. Semantic Color System

Use CSS custom properties (variables) for a consistent, maintainable color system:

```css
/* In your global CSS file */
@layer base {
  :root {
    --color-primary: 59 130 246; /* blue-500 */
    --color-secondary: 16 185 129; /* emerald-500 */
    --color-accent: 245 158 11; /* amber-500 */
    --color-success: 34 197 94; /* green-500 */
    --color-warning: 251 146 60; /* orange-400 */
    --color-danger: 239 68 68; /* red-500 */
    --color-neutral: 107 114 128; /* gray-500 */
  }
  
  .dark {
    --color-primary: 96 165 250; /* blue-400 */
    --color-secondary: 52 211 153; /* emerald-400 */
    /* ... adjust for dark mode ... */
  }
}
```

**Usage in Tailwind config:**
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        // ... etc
      }
    }
  }
}
```

**Implementation:**
```html
<button class="bg-primary text-white hover:bg-primary/90
               dark:bg-primary dark:hover:bg-primary/80">
  Primary Action
</button>
```

### 4. Component Composition Patterns

Create consistent, reusable component patterns without custom CSS classes:

```html
<!-- Card Component Pattern -->
<article class="overflow-hidden bg-white rounded-lg shadow-md
                hover:shadow-xl
                dark:bg-gray-800
                transition-shadow duration-300">
  <!-- Card Image -->
  <div class="aspect-video overflow-hidden bg-gray-100
              dark:bg-gray-700">
    <img class="h-full w-full object-cover
                transition-transform duration-300 hover:scale-105" 
         src="..." alt="...">
  </div>
  
  <!-- Card Body -->
  <div class="p-6 space-y-4">
    <h3 class="text-xl font-bold text-gray-900
               dark:text-white">
      Card Title
    </h3>
    <p class="text-gray-600 leading-relaxed
              dark:text-gray-300">
      Card description...
    </p>
  </div>
</article>
```

### 5. Responsive Design Strategy

Follow a mobile-first approach with clear breakpoint progression:

```html
<!-- Mobile-first responsive design -->
<div class="grid grid-cols-1 gap-4 p-4
            sm:grid-cols-2 sm:gap-6 sm:p-6
            md:grid-cols-3
            lg:grid-cols-4 lg:gap-8 lg:p-8
            xl:grid-cols-5
            2xl:grid-cols-6">
  <!-- Grid items -->
</div>
```

### 6. State Management Classes

Organize interactive states clearly and consistently:

```html
<button class="relative px-6 py-3 font-medium text-white bg-indigo-600 rounded-lg
               hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5
               focus:outline-none focus:ring-4 focus:ring-indigo-300
               active:bg-indigo-800 active:translate-y-0
               disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
               dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:focus:ring-indigo-800
               transition-all duration-200">
  Interactive Button
</button>
```

### 7. Animation and Transition Patterns

Use consistent animation utilities for smooth interactions:

```html
<!-- Smooth hover card -->
<div class="group cursor-pointer">
  <div class="overflow-hidden rounded-xl bg-white shadow-md
              transition-all duration-300 ease-out
              group-hover:shadow-2xl group-hover:-translate-y-1">
    <div class="p-6">
      <h3 class="text-xl font-bold text-gray-900
                 transition-colors duration-300
                 group-hover:text-indigo-600">
        Hover me
      </h3>
      <div class="mt-4 flex items-center text-indigo-600 opacity-0
                  transition-all duration-300
                  group-hover:opacity-100 group-hover:translate-x-2">
        Learn more →
      </div>
    </div>
  </div>
</div>
```

### 8. Dark Mode Implementation

Always include dark mode variants for better accessibility:

```html
<!-- Consistent dark mode pattern -->
<div class="bg-white text-gray-900
            dark:bg-gray-800 dark:text-gray-100">
  <h2 class="text-2xl font-bold text-gray-900
             dark:text-white">
    Dark mode aware heading
  </h2>
  <p class="mt-2 text-gray-600
            dark:text-gray-400">
    Supporting text with proper contrast
  </p>
</div>
```

### 9. Form Input Patterns

Consistent, accessible form styling:

```html
<div class="space-y-4">
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1
                  dark:text-gray-300">
      Email Address
    </label>
    <input type="email"
           class="w-full px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg
                  placeholder:text-gray-400
                  hover:border-gray-400
                  focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200
                  disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
                  dark:bg-gray-700 dark:text-white dark:border-gray-600
                  dark:hover:border-gray-500
                  dark:focus:border-indigo-400 dark:focus:ring-indigo-800
                  transition-colors duration-200"
           placeholder="you@example.com">
    <p class="mt-1 text-sm text-gray-500
              dark:text-gray-400">
      We'll never share your email
    </p>
  </div>
</div>
```

### 10. Container and Layout Patterns

Use consistent spacing and max-width constraints:

```html
<!-- Page Container -->
<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
  <!-- Navigation -->
  <nav class="sticky top-0 z-50 bg-white border-b border-gray-200
              dark:bg-gray-800 dark:border-gray-700">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Nav content -->
    </div>
  </nav>
  
  <!-- Main Content -->
  <main class="max-w-7xl mx-auto px-4 py-8
               sm:px-6 sm:py-12
               lg:px-8 lg:py-16">
    <!-- Page content -->
  </main>
</div>
```

### 11. Accessibility Considerations

Always include focus states and ARIA attributes where needed:

```html
<button class="relative px-4 py-2 bg-blue-600 text-white rounded-lg
               hover:bg-blue-700
               focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
               focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
        aria-label="Save changes"
        role="button">
  <span class="sr-only">Save</span>
  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
    <!-- Icon -->
  </svg>
</button>
```

### 12. Performance Optimization

Avoid unnecessary classes and use Tailwind's built-in optimizations:

```html
<!-- Avoid -->
<div class="flex flex-row items-start justify-start"> <!-- flex-row and justify-start are defaults -->

<!-- Prefer -->
<div class="flex items-start">

<!-- Use arbitrary values sparingly -->
<div class="w-[437px]"> <!-- Avoid -->
<div class="w-96"> <!-- Prefer nearest standard value -->
```

## Best Practices Summary

1. **Be Consistent**: Use the same patterns throughout your application
2. **Mobile First**: Start with mobile styles, add responsive modifiers
3. **Semantic HTML**: Use proper HTML elements before adding styling
4. **Accessibility**: Always include focus states and proper contrast
5. **Performance**: Let PurgeCSS remove unused styles in production
6. **Documentation**: Comment complex utility combinations
7. **Avoid @apply**: Use utility classes directly in HTML when possible
8. **Group Logically**: Keep related utilities together
9. **Dark Mode**: Always consider dark mode variants
10. **Test Responsive**: Verify layouts at all breakpoints

## Common Anti-Patterns to Avoid

```html
<!-- ❌ Don't do this -->
<div class="flex justify-center items-center p-4 m-4 bg-blue-500 text-white rounded hover:bg-blue-600 sm:p-6 md:p-8 lg:p-10 xl:p-12 dark:bg-blue-600">

<!-- ✅ Do this instead -->
<div class="flex items-center justify-center
            p-4 m-4
            bg-blue-500 text-white rounded
            hover:bg-blue-600
            dark:bg-blue-600
            sm:p-6 md:p-8 lg:p-10 xl:p-12">
```

## Example Component Library Structure

When building reusable components, follow this pattern:

```html
<!-- Button variants using data attributes -->
<button data-variant="primary"
        class="px-4 py-2 font-medium rounded-lg transition-all duration-200
               data-[variant=primary]:bg-blue-600 data-[variant=primary]:text-white
               data-[variant=primary]:hover:bg-blue-700
               data-[variant=secondary]:bg-gray-200 data-[variant=secondary]:text-gray-900
               data-[variant=secondary]:hover:bg-gray-300
               data-[variant=danger]:bg-red-600 data-[variant=danger]:text-white
               data-[variant=danger]:hover:bg-red-700
               focus:outline-none focus:ring-2 focus:ring-offset-2
               disabled:opacity-50 disabled:cursor-not-allowed">
  Dynamic Button
</button>
```

This approach keeps your HTML semantic while leveraging Tailwind's full power without custom CSS.