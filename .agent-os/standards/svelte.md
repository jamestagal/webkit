# Svelte and SvelteKit Style Guide


## MANDATORY: Svelte 5 Compliance Requirements

### 🚨 CRITICAL: This project uses Svelte 5 with runes
**NEVER use Svelte 4 patterns. ALWAYS use Svelte 5 runes.**

### ❌ FORBIDDEN Svelte 4 Patterns:
```svelte
<!-- DO NOT USE THESE -->
export let prop = 'default';        // ❌ Use $props()
$: reactive = count * 2;            // ❌ Use $derived()
<button on:click={handler}>         // ❌ Use onclick={handler}
<slot />                             // ❌ Use snippets
```

### ✅ REQUIRED Svelte 5 Patterns:
```svelte
<!-- ALWAYS USE THESE -->
let { prop = 'default' } = $props();   // ✅ Correct props
let reactive = $derived(count * 2);     // ✅ Correct reactivity
<button onclick={handler}>              // ✅ Correct events
{@render children?.()}                   // ✅ Correct slots
```

## Core Implementation Principles

1. **Component Architecture**:
   
   ⚠️ **CRITICAL REQUIREMENT: ALWAYS USE EXISTING COMPONENTS FIRST**
   
   Before creating ANY new component or UI element, you MUST:
   - **CHECK** `/src/lib/client/components/` directory for existing components
   - **REVIEW** component documentation and usage examples in the files
   - **USE** existing components whenever possible - DO NOT reinvent the wheel
   - **EXTEND** existing components if needed rather than creating duplicates
   - **ONLY** create new components when absolutely no existing solution fits
   
   Component reuse checklist:
   - [ ] Searched `/src/lib/client/components/` for similar functionality
   - [ ] Reviewed existing component props and features
   - [ ] Attempted to use/extend existing component
   - [ ] Documented why a new component is necessary (if creating new)
   
   - Create reusable, composable components
   - Follow single responsibility principle
   - Implement proper prop validation
   - Use Svelte 5 runes for all reactivity

2. **State Management**:
   - Use `$state()` for reactive state
   - Implement `$derived()` for computed values
   - Apply `$effect()` for side effects
   - Consider stores for global state

3. **API Integration**:
   - Consume backends APIs exactly as defined in `shared/interfaces.md`
   - Implement proper error handling
   - Add loading states
   - Handle edge cases

4. **Styling with TailwindCSS v4**:
   - Use utility-first approach
   - Follow project's design system
   - Ensure responsive design
   - Maintain consistency
   
   **Color System Usage**:
   ```css
   border-primary-4    /* Light borders */
   border-primary-3    /* Medium borders */
   bg-primary         /* Hover states */
   text-secondary-4   /* Placeholder text */
   ```
   
   **Spacing Patterns**:
   ```css
   gap-1    /* Label to input */
   gap-2    /* Icon to content */
   gap-6    /* Section spacing */
   p-2      /* Standard padding */
   ```
   
   **Layout Patterns**:
   ```css
   flex flex-col w-full gap-1              /* Form field */
   grid grid-cols-1 lg:grid-cols-2 gap-6   /* Responsive grid */
   ```

5. **Accessibility**:
   - Semantic HTML structure
   - ARIA labels where needed
   - Keyboard navigation support
   - Screen reader compatibility

6. **Performance**:
   - Lazy loading for heavy components
   - Image optimization
   - Code splitting with SvelteKit
   - Minimize bundle size

## Implementation Workflow

1. **Review Backend APIs**: Understand all endpoints
2. **Create Components**: Build reusable UI components
3. **Implement Routes**: Set up SvelteKit pages and layouts
4. **Connect to APIs**: Integrate with backend services
5. **Add Interactivity**: Implement user interactions
6. **Ensure Responsiveness**: Test on multiple devices
7. **Document Components**: Add usage examples

## 🚨 MANDATORY: Component Discovery Process

Before implementing ANY UI feature, follow this process:

### Step 1: Check Existing Components
```bash
# List all available components
ls -la /src/lib/client/components/

# Search for specific functionality
grep -r "button\|input\|modal\|form" /src/lib/client/components/

# Check component usage examples
cat /src/lib/client/components/[ComponentName].svelte
```

### Step 2: Review Component Capabilities
- Read the `@component` documentation in each file
- Check available props and their types
- Review any usage examples in comments
- Look for similar implementations in existing routes

### Step 3: Common Components You MUST Use

#### Input Component (`@components/Input.svelte`)
**Purpose**: Standardized text input with consistent styling and features
- Built-in icon support and button integration
- Consistent focus states and styling
- Uses `...restProps` pattern for extensibility
```svelte
<Input
    label="Course Title"
    bind:value={formData.title}
    placeholder="Enter course title"
    required
/>
```

#### Select Component (`@components/Select.svelte`)
**Purpose**: Dropdown selection with search and reset functionality
- Options MUST use `{ name: 'Display', value: 'actual' }` format
- Automatic value matching and display
- Built-in reset functionality
```svelte
<Select
    label="Difficulty Level"
    bind:value={formData.level}
    options={[
        { name: 'Beginner', value: 'beginner' },
        { name: 'Intermediate', value: 'intermediate' }
    ]}
/>
```

#### Number Component (`@components/Number.svelte`)
**Purpose**: Numeric input with increment/decrement controls
- Visual increment/decrement buttons with animations
- Step control for precision (e.g., `step={0.5}`)
- Min/max constraint handling
```svelte
<Number
    label="Estimated Hours"
    bind:value={formData.estimatedHours}
    step={0.5}
    min={0}
/>
```

#### Calendar Component (`@components/Calendar.svelte`)
**Purpose**: Date selection with modal integration
- Modal-friendly date picker
- Date range support
- Constraint handling (min/max dates)
```svelte
{#if showStartDateCalendar}
    <Modal bind:this={startDateModalRef} title="Select Start Date">
        <Calendar
            bind:currentDate={formData.startDate}
            onselect={handleStartDateChange}
        />
    </Modal>
{/if}
```

#### Modal Component (`@components/Modal.svelte`)
**Purpose**: Standardized modal dialogs with accessibility
- Native `<dialog>` element usage
- `bind:this` reference pattern
- `showModal()` and `close()` methods
```svelte
<Modal bind:this={modalReference} title="Modal Title">
    <!-- Modal content -->
</Modal>
<script>
    let modalReference = $state();
    modalReference?.showModal(); // To open
    modalReference?.close();     // To close
</script>
```

#### Button Component (`@components/Button.svelte`)
**Purpose**: Standardized button styling with variants

#### Toast Component (`@components/Toast.svelte`)
**Purpose**: Notification system for user feedback

#### ImageCropper Component (`@components/ImageCropper.svelte`)
**Purpose**: Image cropping functionality with modal integration

### Step 4: Document Component Usage
If you use an existing component in a new way:
- Add usage example to the component file
- Document any discovered patterns
- Update this guide with findings

❌ **NEVER**: Create custom inputs, buttons, or modals without first attempting to use existing components
✅ **ALWAYS**: Check, review, attempt to use, then extend if needed, and only create new as last resort

## Form Data Handling Patterns

### Consistent Data Types
```javascript
// ✅ CORRECT Data Types
formData = $state({
    title: '',              // Strings for text
    level: 'beginner',      // String for select values
    estimatedHours: 0,      // Numbers are numeric
    tags: [],               // Arrays for multi-select
    isPublic: false         // Booleans for checkboxes
});

// ❌ WRONG Data Types
formData = $state({
    estimatedHours: '0',    // Don't use strings for numbers
    tags: '',               // Don't use strings for arrays
    level: null             // Don't use null for required fields
});
```

### Option Structure Pattern
```javascript
// ✅ CORRECT Option Format
options = [
    { name: 'Display Name', value: 'actual_value' },
    { name: 'Another Option', value: 'another_value' }
];

// ❌ WRONG Option Formats
options = ['option1', 'option2'];  // Don't use plain arrays
options = [
    { label: 'Display', id: 'value' }  // Wrong property names
];
```

### Form Validation Pattern
```svelte
let errors = $state({});

function validateForm() {
    const newErrors = {};
    
    if (!formData.title?.trim()) {
        newErrors.title = 'Title is required';
    }
    
    if (formData.estimatedHours < 0) {
        newErrors.estimatedHours = 'Hours must be positive';
    }
    
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
}

// Display errors in UI
{#if errors.title}
    <span class="text-danger text-xs mt-1">{errors.title}</span>
{/if}
```

## Output Format

Your deliverables include:
- Complete Svelte 5 components with proper runes
- SvelteKit routes and layouts
- API integration code
- Styling with TailwindCSS v4
- Component documentation

After completing tasks, create:
1. LOG: Write to ~/.agent-os/logs/[agent-name].log
2. RECAP: Create recap in ~/.agent-os/recaps/
3. UPDATE: Update roadmap if applicable
4. NOTIFY: Report completion to project-manager

## Common Mistakes to Avoid

### Component Usage Mistakes
```svelte
<!-- ❌ WRONG: Creating custom input -->
<div class="custom-input">
    <input type="text" bind:value={value} />
</div>

<!-- ✅ CORRECT: Use existing component -->
<Input bind:value={value} label="Field Label" />
```

### Prop Pattern Mistakes
```svelte
<!-- ❌ WRONG: Incorrect option structure -->
<Select options={['option1', 'option2']} />

<!-- ✅ CORRECT: Proper option structure -->
<Select options={[
    { name: 'Option 1', value: 'option1' },
    { name: 'Option 2', value: 'option2' }
]} />
```

### State Management Mistakes
```svelte
<!-- ❌ WRONG: Svelte 4 pattern -->
export let prop = 'default';
$: reactive = count * 2;

<!-- ✅ CORRECT: Svelte 5 runes -->
let { prop = 'default' } = $props();
let reactive = $derived(count * 2);
```

### Z-Index and Layering Issues
```svelte
<!-- ❌ WRONG: Dropdown behind other elements -->
<Select ... />

<!-- ✅ CORRECT: Proper z-index management -->
<div style="z-index: 100; position: relative;">
    <Select ... />
</div>
```

## Quality Standards

- **NO Svelte 4 patterns** - Only Svelte 5 runes
- **Type Safety**: Use TypeScript where applicable
- **Error Boundaries**: Graceful error handling
- **Loading States**: Never leave user wondering
- **Responsive Design**: Works on all devices
- **Cross-browser**: Test in major browsers
- **Performance**: Lighthouse score > 90


## When Prerequisites Are Missing

If required documentation or APIs are not ready:
1. **Document what's missing** with specific details
2. **Create mock data** for development to continue
3. **Flag assumptions** for validation
4. **Request missing information** from Orchestrator

## 🔴 FINAL CRITICAL REMINDER

**COMPONENT REUSE IS MANDATORY - NOT OPTIONAL**

Before writing ANY new component code:
1. ✅ You MUST have checked `/src/lib/client/components/`
2. ✅ You MUST have attempted to use existing components
3. ✅ You MUST document why existing components don't work (if creating new)

Creating duplicate components when existing ones could be used is considered a **CRITICAL ERROR** and will require refactoring.

Remember: Your frontend is the user's experience. Make it intuitive, fast, and delightful while strictly adhering to Svelte 5 patterns and architectural specifications.

MANDATORY: Create summary documentation and update all shared resources upon completion.
