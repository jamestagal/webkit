# Svelte Style Guide

## Core Principles

### Svelte 5 Compliance (MANDATORY)
**ALWAYS use Svelte 5 runes. NEVER use Svelte 4 patterns.**

#### ❌ Forbidden Svelte 4 Patterns:
```svelte
<!-- DO NOT USE -->
export let prop = 'default';        // ❌ Use $props()
$: reactive = count * 2;            // ❌ Use $derived()
<button on:click={handler}>         // ❌ Use onclick={handler}
<slot />                            // ❌ Use snippets
```

#### ✅ Required Svelte 5 Patterns:
```svelte
<!-- ALWAYS USE -->
let { prop = 'default' } = $props();   // ✅ Correct props
let reactive = $derived(count * 2);     // ✅ Correct reactivity
<button onclick={handler}>              // ✅ Correct events
{@render children?.()}                  // ✅ Correct slots/snippets
```

## Component Architecture

### 1. Component Structure
```svelte
<script>
  // 1. Imports first
  import { ComponentName } from '$lib/components';

  // 2. Props destructuring
  let {
    prop1 = 'default',
    prop2,
    class: className = '',
    ...restProps
  } = $props();

  // 3. State variables
  let localState = $state('initial');

  // 4. Derived values
  let computed = $derived(localState.toUpperCase());

  // 5. Effects
  $effect(() => {
    // Side effects here
  });

  // 6. Functions
  function handleAction() {
    // Event handlers
  }
</script>

<!-- Template -->
<div class={className} {...restProps}>
  {computed}
</div>
```

### 2. Component Reuse Priority
**ALWAYS check for existing components before creating new ones:**

1. Search `/src/lib/components/` directory
2. Review component documentation and props
3. Attempt to use or extend existing components
4. Only create new components when no existing solution fits

### 3. Naming Conventions
- **Components**: PascalCase files (`UserProfile.svelte`)
- **Props**: camelCase (`userName`, `isActive`)
- **Events**: Descriptive handlers (`onclick`, `onsubmit`)
- **State**: Descriptive variables (`isLoading`, `userList`)

## State Management Patterns

### Reactive State
```svelte
// Local component state
let count = $state(0);
let user = $state({ name: '', email: '' });

// Derived state
let doubleCount = $derived(count * 2);
let fullName = $derived(`${user.name} (${user.email})`);

// Effects for side effects
$effect(() => {
  console.log('Count changed:', count);
});
```

### Form Data Handling
```svelte
// Consistent data types
let formData = $state({
  title: '',              // Strings for text
  level: 'beginner',      // Strings for select values
  count: 0,               // Numbers for numeric values
  tags: [],               // Arrays for multi-select
  isActive: false         // Booleans for checkboxes
});

// Validation pattern
let errors = $state({});

function validateForm() {
  const newErrors = {};

  if (!formData.title?.trim()) {
    newErrors.title = 'Title is required';
  }

  errors = newErrors;
  return Object.keys(newErrors).length === 0;
}
```

## Event Handling

### Modern Event Syntax
```svelte
<!-- Use modern event attributes -->
<button onclick={handleClick}>Click me</button>
<form onsubmit={handleSubmit}>
<input oninput={handleInput} bind:value={text} />

<!-- Event with parameters -->
<button onclick={() => handleDelete(item.id)}>Delete</button>
```

### Event Handler Patterns
```svelte
<script>
  function handleSubmit(event) {
    event.preventDefault();
    // Handle form submission
  }

  function handleInput(event) {
    const value = event.target.value;
    // Handle input change
  }
</script>
```

## Component Communication

### Props and Binding
```svelte
<!-- Parent component -->
<ChildComponent
  bind:value={parentValue}
  {otherProp}
  onchange={handleChange}
/>

<!-- Child component -->
<script>
  let {
    value = $bindable(),
    otherProp,
    onchange = () => {}
  } = $props();
</script>
```

### Custom Events
```svelte
<!-- Child dispatches custom event -->
<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('custom-event', { data: 'value' });
  }
</script>

<!-- Parent listens -->
<ChildComponent on:custom-event={handleCustomEvent} />
```

## Styling Integration

### TailwindCSS Patterns
```svelte
<!-- Responsive layouts -->
<div class="flex flex-col w-full gap-1">               <!-- Form field -->
<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">   <!-- Responsive grid -->

<!-- Common spacing -->
<div class="gap-1">    <!-- Label to input -->
<div class="gap-2">    <!-- Icon to content -->
<div class="gap-6">    <!-- Section spacing -->
<div class="p-2">      <!-- Standard padding -->
```

### Dynamic Classes
```svelte
<script>
  let { variant = 'primary', size = 'md' } = $props();

  let buttonClasses = $derived(`
    btn
    btn-${variant}
    btn-${size}
    ${variant === 'primary' ? 'font-semibold' : ''}
  `.trim());
</script>

<button class={buttonClasses}>
  Styled Button
</button>
```

## Common Patterns

### Loading States
```svelte
<script>
  let isLoading = $state(false);
  let data = $state(null);

  async function fetchData() {
    isLoading = true;
    try {
      data = await api.getData();
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      isLoading = false;
    }
  }
</script>

{#if isLoading}
  <div>Loading...</div>
{:else if data}
  <div>{data.content}</div>
{:else}
  <div>No data available</div>
{/if}
```

### Form Validation Display
```svelte
<!-- Input with error handling -->
<div class="flex flex-col gap-1">
  <label for="title">Title</label>
  <input
    id="title"
    bind:value={formData.title}
    class="input {errors.title ? 'border-red-500' : ''}"
  />
  {#if errors.title}
    <span class="text-red-500 text-xs">{errors.title}</span>
  {/if}
</div>
```

### Select Component Options
```svelte
<script>
  // Always use name/value object structure
  let options = [
    { name: 'Display Name', value: 'actual_value' },
    { name: 'Another Option', value: 'another_value' }
  ];
</script>

<Select bind:value={selectedValue} {options} />
```

## Performance Best Practices

### Efficient Reactivity
```svelte
<script>
  // Good: Specific dependencies
  let expensiveComputation = $derived(
    someSpecificValue ? complexCalculation(someSpecificValue) : null
  );

  // Avoid: Over-reactive patterns
  // let everything = $derived(doLotsOfWork()); // ❌ Runs too often
</script>
```

### Component Optimization
```svelte
<!-- Use keyed each blocks for dynamic lists -->
{#each items as item (item.id)}
  <ItemComponent {item} />
{/each}

<!-- Lazy load heavy components -->
{#await import('./HeavyComponent.svelte') then { default: HeavyComponent }}
  <HeavyComponent {props} />
{/await}
```

## Accessibility Standards

### Semantic Structure
```svelte
<!-- Use semantic HTML -->
<header>
  <nav aria-label="Main navigation">
    <ul role="list">
      <li><a href="/">Home</a></li>
    </ul>
  </nav>
</header>

<main>
  <section aria-labelledby="section-title">
    <h2 id="section-title">Content Section</h2>
  </section>
</main>
```

### Form Accessibility
```svelte
<!-- Proper form labeling -->
<label for="email">Email Address</label>
<input
  id="email"
  type="email"
  bind:value={email}
  aria-describedby="email-error"
  aria-invalid={errors.email ? 'true' : 'false'}
/>
{#if errors.email}
  <div id="email-error" role="alert">
    {errors.email}
  </div>
{/if}
```

## Common Mistakes to Avoid

### ❌ Wrong Patterns
```svelte
<!-- Don't mix Svelte versions -->
export let prop = 'default';           // ❌ Svelte 4
let { prop = 'default' } = $props();   // ✅ Svelte 5

<!-- Don't use incorrect option formats -->
<Select options={['opt1', 'opt2']} />  // ❌ Wrong
<Select options={[{name: 'Opt 1', value: 'opt1'}]} />  // ✅ Correct

<!-- Don't create duplicate components -->
<div class="custom-input">             // ❌ Reinventing wheel
<Input {props} />                      // ✅ Use existing
```

### ✅ Correct Patterns
```svelte
<!-- Modern Svelte 5 syntax -->
<script>
  let { items = [] } = $props();
  let filteredItems = $derived(items.filter(item => item.active));
</script>

{#each filteredItems as item (item.id)}
  <div>{item.name}</div>
{/each}
```

## Client-Server Communication

### Remote Functions (Preferred - SvelteKit 2.27+)

For detailed Remote Functions patterns, see `.agent-os/standards/remote-functions.md`

**Quick Reference:**
```typescript
// In *.remote.ts files
import { query, form, command } from '$app/server';

// Read data
export const getPosts = query(async () => { /* ... */ });

// Form submission
export const createPost = form(schema, async (data) => { /* ... */ });

// Imperative mutation
export const likePost = command(z.number(), async (id) => { /* ... */ });
```

```svelte
<!-- In components -->
<script lang="ts">
  import { getPosts, createPost } from '$lib/api/posts.remote';

  // Use with await
  const posts = await getPosts();
</script>

<!-- Forms with progressive enhancement -->
<form {...createPost}>
  <input {...createPost.fields.title.as('text')} />
  <button aria-busy={!!createPost.pending}>Submit</button>
</form>
```

### Traditional Patterns (Legacy)

Only use when Remote Functions are unavailable:
- Form actions in `+page.server.ts`
- API routes in `+server.ts`
- Load functions in `+page.ts`

## Quality Checklist

Before committing Svelte code, verify:

- [ ] Uses Svelte 5 runes (no Svelte 4 patterns)
- [ ] Uses Remote Functions for client-server communication (when available)
- [ ] Checked for existing components before creating new ones
- [ ] Follows consistent naming conventions
- [ ] Implements proper error handling
- [ ] Includes loading states where appropriate
- [ ] Uses semantic HTML structure
- [ ] Maintains responsive design
- [ ] Includes proper TypeScript types (if applicable)
- [ ] Follows project's TailwindCSS patterns
- [ ] Validates all remote function inputs with Zod schemas