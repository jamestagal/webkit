# Form Customization UI Specification

## Overview

This document outlines the requirements for building a UI that allows agency owners/admins to customize the consultation form options for their agency.

## Current State

### Backend (Complete)
- `agency_form_options` table stores customizable options per agency
- 14 configurable categories (industry, budget_range, etc.)
- Remote functions exist: `getAgencyFormOptions()`, `updateFormOptions()`
- Form components read from `getAgencyConfig()` with fallback to defaults

### What's Missing
- **UI for managing form options** - No settings page exists yet
- The `/[agencySlug]/settings/form-options` route needs to be created

## Proposed Route Structure

```
/[agencySlug]/settings/                    # General agency settings
/[agencySlug]/settings/branding/           # Logo, colors
/[agencySlug]/settings/form-options/       # Form customization (this spec)
/[agencySlug]/settings/members/            # Member management
```

## UI Requirements

### Form Options Editor Page

**Location:** `/[agencySlug]/settings/form-options/+page.svelte`

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Settings > Form Options                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────┐  ┌────────────────────────────────────────┐ │
│ │ Categories      │  │ Industry Options                       │ │
│ │                 │  │                                        │ │
│ │ ○ Industry     ←│  │ Customize the industry dropdown shown  │ │
│ │ ○ Business Type │  │ to clients in the consultation form.   │ │
│ │ ○ Budget Range  │  │                                        │ │
│ │ ○ Urgency Level │  │ ┌────────────────────────────────────┐ │ │
│ │ ○ Challenges    │  │ │ Technology        [×] [↑] [↓]      │ │ │
│ │ ○ Tech Issues   │  │ │ Healthcare        [×] [↑] [↓]      │ │ │
│ │ ○ Solution Gaps │  │ │ E-commerce        [×] [↑] [↓]      │ │ │
│ │ ○ Digital Pres. │  │ │ Education         [×] [↑] [↓]      │ │ │
│ │ ○ Marketing Ch. │  │ │ Professional Svcs [×] [↑] [↓]      │ │ │
│ │ ○ Primary Goals │  │ └────────────────────────────────────┘ │ │
│ │ ○ Secondary G.  │  │                                        │ │
│ │ ○ Success Metr. │  │ ┌────────────────────────────────────┐ │ │
│ │ ○ KPIs          │  │ │ + Add new option                   │ │ │
│ │ ○ Budget Constr.│  │ └────────────────────────────────────┘ │ │
│ │                 │  │                                        │ │
│ └─────────────────┘  │ [Reset to Defaults]    [Save Changes]  │ │
│                      └────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Features Required

#### 1. Category Sidebar
- List all 14 configurable categories
- Visual indicator showing which have custom options vs. defaults
- Click to switch editor panel

#### 2. Options Editor Panel
- **View options**: List current options for selected category
- **Add option**: Input field + button to add new option
- **Remove option**: X button to delete an option
- **Reorder options**: Drag-and-drop or up/down arrows
- **Edit option**: Click to edit existing option text

#### 3. Actions
- **Save Changes**: Persist to database via `updateFormOptions()`
- **Reset to Defaults**: Clear custom options, revert to system defaults
- **Preview**: Optional - show how the dropdown will look in the form

### Data Structure

Each category stores options as a JSONB array:

```typescript
// Current format in agency_form_options table
{
    id: string;
    agencyId: string;
    category: 'industry' | 'budget_range' | ...;
    options: string[];  // Simple array of strings
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
```

### Component Breakdown

#### 1. FormOptionsPage.svelte
- Main page component
- Manages selected category state
- Handles save/reset actions

#### 2. CategoryList.svelte
- Sidebar listing all 14 categories
- Shows status (custom vs default)
- Handles category selection

#### 3. OptionEditor.svelte
- Editable list of options
- Add/remove/reorder functionality
- Inline editing

### Remote Functions Needed

Already implemented in `agency.remote.ts`:
```typescript
// Get all form options for agency
getAgencyFormOptions(): Promise<AgencyFormOption[]>

// Update options for a category
updateFormOptions(category: FormOptionCategory, options: string[]): Promise<void>
```

May need to add:
```typescript
// Reset a category to defaults
resetFormOptions(category: FormOptionCategory): Promise<void>

// Get default options for a category (for preview/comparison)
getDefaultFormOptions(category: FormOptionCategory): Promise<string[]>
```

## Implementation Steps

1. **Create settings layout** (`/[agencySlug]/settings/+layout.svelte`)
   - Settings navigation sidebar
   - Breadcrumb navigation

2. **Create form-options page** (`/[agencySlug]/settings/form-options/+page.svelte`)
   - Load current agency form options
   - Category selection state
   - Save/reset handlers

3. **Create CategoryList component**
   - Display 14 categories with labels
   - Indicate custom vs default status

4. **Create OptionEditor component**
   - List view with add/remove/reorder
   - Optimistic updates with error handling

5. **Add preview functionality** (optional)
   - Show mock dropdown with current options

## Access Control

- **Who can access**: Owner and Admin roles only
- **Permission check**: `requireAgencyRole(['owner', 'admin'])`
- **Route protection**: In `+layout.server.ts` or `+page.server.ts`

## Future Enhancements

### Phase 2: Advanced Options
- **Option metadata**: Add descriptions, icons, or colors to options
- **Conditional options**: Show certain options based on previous answers
- **Option groups**: Group related options together

### Phase 3: Form Builder
- **Drag-and-drop form builder**: Reorder entire form sections
- **Custom questions**: Add agency-specific questions
- **Required/optional fields**: Toggle which fields are mandatory
- **Conditional logic**: Show/hide sections based on answers

### Phase 4: Templates
- **Form templates**: Pre-built consultation templates
- **Industry-specific templates**: Different forms for different verticals
- **Template marketplace**: Share/sell templates between agencies

---

*Created: December 25, 2024*
*Status: Planning*
