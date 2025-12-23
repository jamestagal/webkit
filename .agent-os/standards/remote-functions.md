# SvelteKit Remote Functions - Best Practices & Patterns

## Context

Remote Functions are SvelteKit's modern approach to type-safe client-server communication (available since SvelteKit 2.27+). They replace traditional form actions and API routes with a streamlined, reactive pattern.

## Quick Reference

### When to Use Remote Functions

✅ **Use Remote Functions**:
- Type-safe data fetching and mutations
- Progressive enhancement (forms work without JS)
- Automatic caching and reactivity
- Optimistic UI updates
- Single-flight mutations

❌ **Don't Use**:
- SvelteKit < 2.27
- When you need full control over HTTP layer
- Server-side only operations (use server utilities)

### Five Remote Function Types

1. **query** - Read dynamic data
2. **query.batch** - Batch multiple queries (n+1 prevention)
3. **form** - Form submissions with progressive enhancement
4. **command** - Imperative mutations
5. **prerender** - Static/build-time data

## Configuration

### Enable in svelte.config.js

```javascript
export default {
  kit: {
    experimental: {
      remoteFunctions: true
    }
  },
  compilerOptions: {
    experimental: {
      async: true  // Enables await in templates
    }
  }
};
```

## File Organization

```
src/lib/
├── api/                      # Remote function files
│   ├── posts.remote.ts      # Domain-specific functions
│   ├── auth.remote.ts
│   └── comments.remote.ts
├── schema/                   # Validation schemas (shared)
│   ├── posts.ts
│   └── auth.ts
└── server/                   # Server-only utilities
    ├── database.ts
    └── auth.ts
```

### Naming Conventions

- Remote function files: `*.remote.ts`
- Location: `src/lib/api/` or `src/routes/*/data.remote.ts`
- Schema files: `src/lib/schema/*.ts`
- Functions: Descriptive verbs (getPosts, createPost, likePost)

## Pattern: query - Read Data

### Basic Query

```typescript
// src/lib/api/posts.remote.ts
import { query } from '$app/server';
import * as db from '$lib/server/database';

export const getPosts = query(async () => {
  return await db.select().from(table.posts);
});
```

### Query with Validation

```typescript
import { query } from '$app/server';
import { z } from 'zod';
import { error } from '@sveltejs/kit';

export const getPost = query(z.string(), async (slug) => {
  const [post] = await db.select()
    .from(table.posts)
    .where(eq(table.posts.slug, slug));

  if (!post) error(404, 'Not found');
  return post;
});
```

### Query with Authentication

```typescript
import { query, getRequestEvent } from '$app/server';
import { redirect } from '@sveltejs/kit';

// Reusable auth helper
function requireAuth() {
  const { locals } = getRequestEvent();
  if (!locals.user) redirect(307, '/auth/login');
  return locals.user;
}

export const getMyPosts = query(async () => {
  const user = requireAuth();
  return await db.select()
    .from(table.posts)
    .where(eq(table.posts.authorId, user.id));
});
```

### Component Usage

```svelte
<script lang="ts">
  import { getPosts, getPost } from '$lib/api/posts.remote';

  let { params } = $props();

  // Recommended: await in template
  const post = $derived(await getPost(params.slug));
</script>

<h1>{post.title}</h1>

<!-- List with await -->
{#each await getPosts() as post}
  <article>{post.title}</article>
{/each}

<!-- Refresh button -->
<button onclick={() => getPosts().refresh()}>
  Refresh
</button>
```

### Alternative: loading/error/current

```svelte
<script lang="ts">
  import { getPosts } from '$lib/api/posts.remote';
  const query = getPosts();
</script>

{#if query.error}
  <p>Error: {query.error.message}</p>
{:else if query.loading}
  <p>Loading...</p>
{:else}
  {#each query.current as post}
    <article>{post.title}</article>
  {/each}
{/if}
```

## Pattern: query.batch - Prevent N+1 Queries

```typescript
// weather.remote.ts
import { query } from '$app/server';
import { z } from 'zod';

export const getWeather = query.batch(z.string(), async (cityIds) => {
  // Single DB query for all cities
  const weather = await db.select()
    .from(table.weather)
    .where(inArray(table.weather.cityId, cityIds));

  const lookup = new Map(weather.map(w => [w.cityId, w]));

  // Return resolver function
  return (cityId) => lookup.get(cityId);
});
```

```svelte
<!-- All getWeather calls in same tick = 1 DB query -->
{#each cities as city}
  <h3>{city.name}</h3>
  <p>{await getWeather(city.id)}</p>
{/each}
```

## Pattern: form - Progressive Enhancement

### Basic Form

```typescript
// posts.remote.ts
import { form, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { redirect } from '@sveltejs/kit';

const createPostSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  content: z.string().min(1)
});

export const createPost = form(createPostSchema, async (data) => {
  const { locals } = getRequestEvent();
  if (!locals.user) error(401, 'Unauthorized');

  await db.insert(table.posts).values({
    ...data,
    authorId: locals.user.id
  });

  redirect(303, `/blog/${data.slug}`);
});
```

```svelte
<script lang="ts">
  import { createPost } from '$lib/api/posts.remote';
</script>

<form {...createPost}>
  <label>
    Title
    <input {...createPost.fields.title.as('text')} />
    {#each createPost.fields.title.issues() as issue}
      <p class="error">{issue.message}</p>
    {/each}
  </label>

  <label>
    Slug
    <input {...createPost.fields.slug.as('text')} />
    {#each createPost.fields.slug.issues() as issue}
      <p class="error">{issue.message}</p>
    {/each}
  </label>

  <label>
    Content
    <textarea {...createPost.fields.content.as('text')}></textarea>
    {#each createPost.fields.content.issues() as issue}
      <p class="error">{issue.message}</p>
    {/each}
  </label>

  <button type="submit" aria-busy={!!createPost.pending}>
    Publish
  </button>
</form>
```

### Form Field Types

```svelte
<!-- Text input -->
<input {...form.fields.title.as('text')} />

<!-- Number input -->
<input {...form.fields.age.as('number')} />

<!-- Email input -->
<input {...form.fields.email.as('email')} />

<!-- Password input -->
<input {...form.fields.password.as('password')} />

<!-- Checkbox -->
<input {...form.fields.agree.as('checkbox')} />

<!-- Radio (with value) -->
<input {...form.fields.plan.as('radio', 'basic')} />
<input {...form.fields.plan.as('radio', 'pro')} />

<!-- Select -->
<select {...form.fields.country.as('select')}>
  <option>USA</option>
  <option>UK</option>
</select>

<!-- File upload -->
<input {...form.fields.avatar.as('file')} />

<!-- Hidden field -->
<input {...form.fields.id.as('hidden', post.id.toString())} />

<!-- Textarea -->
<textarea {...form.fields.content.as('text')}></textarea>
```

### Form with Multiple Actions

```typescript
export const updatePost = form(updateSchema, async (data) => {
  await db.update(table.posts).set(data);
});

export const deletePost = form(deleteSchema, async ({ id }) => {
  await db.delete(table.posts).where(eq(table.posts.id, id));
  redirect(303, '/posts');
});
```

```svelte
<form {...updatePost}>
  <input {...updatePost.fields.title.as('text')} />

  <button type="submit">Update</button>
  <button {...deletePost.buttonProps}>Delete</button>
</form>
```

### Form Validation

```svelte
<script lang="ts">
  import { createPost } from '$lib/api/posts.remote';
  import { z } from 'zod';

  // Client-side preflight schema
  const schema = z.object({
    title: z.string().min(1),
    content: z.string().min(10)
  });
</script>

<!-- Preflight prevents invalid submission -->
<form {...createPost.preflight(schema)}>
  <!-- ... -->
</form>

<!-- Validate on input -->
<form {...createPost} oninput={() => createPost.validate()}>
  <!-- ... -->
</form>

<!-- All issues across fields -->
{#each createPost.fields.allIssues() as issue}
  <p class="error">{issue.message}</p>
{/each}
```

### Form Enhancement (Custom Submit Logic)

```svelte
<script lang="ts">
  import { createPost } from '$lib/api/posts.remote';
  import { showToast } from '$lib/toast';
</script>

<form {...createPost.enhance(async ({ form, data, submit }) => {
  try {
    await submit();
    form.reset();
    showToast('Success!');
  } catch (error) {
    showToast('Error: ' + error.message);
  }
})}>
  <!-- Form fields -->
</form>
```

### Get/Set Field Values

```svelte
<script lang="ts">
  import { createPost } from '$lib/api/posts.remote';

  // Get value
  let title = createPost.fields.title.value();

  // Set value
  createPost.fields.title.set('New Title');

  // Set multiple values
  createPost.fields.set({
    title: 'My Post',
    content: 'Content...'
  });

  // Get all values
  let allValues = createPost.fields.value();
</script>

<!-- Live preview -->
<div class="preview">
  <h2>{createPost.fields.title.value()}</h2>
  <p>{createPost.fields.content.value()}</p>
</div>
```

## Pattern: command - Imperative Mutations

```typescript
// likes.remote.ts
import { command, query } from '$app/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';

export const getLikes = query(z.number(), async (postId) => {
  const [row] = await db.select({ likes: table.posts.likes })
    .from(table.posts)
    .where(eq(table.posts.id, postId));
  return row.likes ?? 0;
});

export const likePost = command(z.number(), async (postId) => {
  await db.update(table.posts)
    .set({ likes: sql`${table.posts.likes} + 1` })
    .where(eq(table.posts.id, postId));

  // Refresh query
  getLikes(postId).refresh();
});
```

```svelte
<script lang="ts">
  import { getLikes, likePost } from '$lib/api/likes.remote';

  let { post } = $props();
</script>

<button
  onclick={() => {
    likePost(post.id).updates(
      getLikes(post.id).withOverride((n) => n + 1)
    );
  }}
>
  ❤️ {await getLikes(post.id)}
</button>
```

## Pattern: prerender - Static Data

```typescript
// posts.remote.ts
import { prerender } from '$app/server';
import { z } from 'zod';

// Prerendered at build time
export const getPosts = prerender(async () => {
  return await db.select().from(table.posts);
});

// With specific inputs
export const getPost = prerender(
  z.string(),
  async (slug) => {
    const [post] = await db.select()
      .from(table.posts)
      .where(eq(table.posts.slug, slug));
    if (!post) error(404);
    return post;
  },
  {
    inputs: () => ['intro', 'getting-started', 'advanced'],
    dynamic: true  // Allow runtime calls too
  }
);
```

## Single-Flight Mutations

### Server-Side Refresh

```typescript
export const createPost = form(schema, async (data) => {
  await db.insert(table.posts).values(data);

  // Refresh on server before redirect
  await getPosts().refresh();

  redirect(303, '/posts');
});
```

### Client-Side with enhance

```svelte
<form {...createPost.enhance(async ({ submit }) => {
  await submit().updates(getPosts());
})}>
  <!-- Form -->
</form>
```

### Optimistic Updates

```svelte
<script lang="ts">
  import { createPost, getPosts } from '$lib/api/posts.remote';

  let newPost = { title: 'Draft', slug: 'draft', content: '' };
</script>

<form {...createPost.enhance(async ({ submit }) => {
  // Add optimistically
  await submit().updates(
    getPosts().withOverride((posts) => [newPost, ...posts])
  );
})}>
  <!-- Form -->
</form>
```

## Schema Validation with Zod

```typescript
// src/lib/schema/posts.ts
import { z } from 'zod/mini';  // Smaller bundle

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createPostSchema = z.object({
  title: z.string().min(1, 'Title required'),
  slug: z.string().check(z.regex(slugRegex, 'Invalid slug')),
  content: z.string().min(10, 'Content too short')
});

export const updatePostSchema = z.object({
  id: z.pipe(
    z.string(),
    z.transform((id) => Number(id))
  ),
  title: z.string(),
  slug: z.string().check(z.regex(slugRegex)),
  content: z.string()
});

// Nested objects
export const profileSchema = z.object({
  name: z.string(),
  email: z.email(),
  settings: z.object({
    theme: z.enum(['light', 'dark']),
    notifications: z.boolean()
  })
});

// Arrays
export const tagsSchema = z.object({
  tags: z.array(z.string())
});

// File uploads
export const uploadSchema = z.object({
  file: z.file(),
  name: z.string()
});
```

## Common Patterns

### Loading States

```svelte
<script lang="ts">
  import { getPosts } from '$lib/api/posts.remote';
</script>

<!-- Using loading/error/current -->
{#if getPosts().loading}
  <div class="spinner">Loading...</div>
{:else if getPosts().error}
  <div class="error">{getPosts().error.message}</div>
{:else}
  {#each getPosts().current as post}
    <article>{post.title}</article>
  {/each}
{/if}

<!-- Or with aria-busy on form -->
<form {...createPost}>
  <button aria-busy={!!createPost.pending}>Submit</button>
</form>
```

### Error Handling

```svelte
<script lang="ts">
  import { likePost } from '$lib/api/posts.remote';
  import { showToast } from '$lib/toast';

  async function handleLike(postId: number) {
    try {
      await likePost(postId);
    } catch (error) {
      showToast('Failed to like post');
      console.error(error);
    }
  }
</script>
```

### Programmatic Validation

```typescript
// In remote function
import { form } from '$app/server';

export const buyProduct = form(schema, async (data, invalid) => {
  try {
    await processPayment(data.amount);
  } catch (e) {
    if (e.code === 'INSUFFICIENT_FUNDS') {
      invalid(invalid.amount('Not enough funds'));
    }
    throw e;
  }
});
```

### Multiple Form Instances

```svelte
<script lang="ts">
  import { getTodos, updateTodo } from '$lib/api/todos.remote';
</script>

{#each await getTodos() as todo}
  {@const form = updateTodo.for(todo.id)}

  <form {...form}>
    <input {...form.fields.title.as('text')} value={todo.title} />
    <button disabled={!!form.pending}>Save</button>
  </form>
{/each}
```

## Best Practices

### 1. Always Validate Inputs

```typescript
// ✅ Good
export const getPost = query(z.string(), async (slug) => {
  // slug is validated
});

// ❌ Bad - no validation
export const getPost = query(async (slug: string) => {
  // slug could be anything!
});
```

### 2. Use getRequestEvent for Context

```typescript
import { getRequestEvent } from '$app/server';

export const getProfile = query(async () => {
  const { locals, cookies } = getRequestEvent();
  const userId = locals.user?.id;
  // ...
});
```

### 3. Organize by Domain

```
src/lib/api/
├── posts.remote.ts      # All post operations
├── auth.remote.ts       # All auth operations
└── comments.remote.ts   # All comment operations
```

### 4. Share Schemas

```typescript
// src/lib/schema/posts.ts
export const createPostSchema = z.object({ /* ... */ });

// posts.remote.ts
import { createPostSchema } from '$lib/schema/posts';
export const createPost = form(createPostSchema, async (data) => {});

// Component
import { createPostSchema } from '$lib/schema/posts';
<form {...createPost.preflight(createPostSchema)}>
```

### 5. Handle Sensitive Data

```svelte
<!-- Use _ prefix for sensitive fields -->
<form {...register}>
  <input {...register.fields.username.as('text')} />
  <input {...register.fields._password.as('password')} />
</form>
```

### 6. Use Batch for Related Queries

```typescript
// ✅ Good - single query
export const getAuthor = query.batch(z.number(), async (authorIds) => {
  const authors = await db.select()
    .from(table.authors)
    .where(inArray(table.authors.id, authorIds));
  const map = new Map(authors.map(a => [a.id, a]));
  return (id) => map.get(id);
});

// ❌ Bad - n+1 queries
export const getAuthor = query(z.number(), async (authorId) => {
  return await db.select()
    .from(table.authors)
    .where(eq(table.authors.id, authorId));
});
```

### 7. Prefer form over command

```typescript
// ✅ Good - works without JS
export const createPost = form(schema, async (data) => {});

// ⚠️ OK - requires JS
export const createPost = command(schema, async (data) => {});
```

### 8. Use prerender for Static Data

```typescript
// ✅ Good - cached at build time
export const getCategories = prerender(async () => {
  return ['Tech', 'Design', 'Business'];
});

// ❌ Bad - fetched on every request
export const getCategories = query(async () => {
  return ['Tech', 'Design', 'Business'];
});
```

### 9. Single-Flight Mutations

```typescript
// ✅ Good - one round trip
export const createPost = form(schema, async (data) => {
  await db.insert(table.posts).values(data);
  await getPosts().refresh();  // Update cache
  redirect(303, '/posts');
});

// ❌ Bad - two round trips
export const createPost = form(schema, async (data) => {
  await db.insert(table.posts).values(data);
  redirect(303, '/posts');
  // Client must refetch getPosts()
});
```

### 10. Type Safety

```typescript
// ✅ Good - fully typed
export const getPost = query(z.string(), async (slug) => {
  const post: Post = await db.query.posts.findFirst({
    where: eq(table.posts.slug, slug)
  });
  return post;
});

// Component gets full types
const post = await getPost('my-slug');
// post.title is typed!
```

## Cognitive Load Guidelines

- Simple query: 3-4
- Query with validation: 4-5
- Basic form: 6-8
- Form with enhance: 10-12
- Batch query: 8-10
- Complex mutations: 12-15

## Migration from Traditional Patterns

### Before: Form Actions

```typescript
// +page.server.ts
export const actions = {
  create: async ({ request, cookies }) => {
    const data = await request.formData();
    // manual validation
    // manual processing
    return { success: true };
  }
};
```

### After: Remote Functions

```typescript
// posts.remote.ts
export const createPost = form(schema, async (data) => {
  // automatic validation
  // typed data
  redirect(303, '/posts');
});
```

### Before: API Routes + Load

```typescript
// +server.ts
export async function GET() {
  const posts = await getPosts();
  return json(posts);
}

// +page.ts
export const load = async ({ fetch }) => {
  const posts = await fetch('/api/posts').then(r => r.json());
  return { posts };
};
```

### After: Direct Query

```typescript
// posts.remote.ts
export const getPosts = query(async () => {
  return await db.select().from(table.posts);
});

// Component
const posts = await getPosts();
```

## Summary

Remote Functions provide:
- ✅ Type safety end-to-end
- ✅ Automatic validation
- ✅ Progressive enhancement
- ✅ Built-in caching
- ✅ Optimistic updates
- ✅ Single-flight mutations
- ✅ Less boilerplate

Use them as the default pattern for all client-server communication in modern SvelteKit applications.
