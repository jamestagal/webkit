# Best Practices for Cloudflare + SvelteKit Development

## Cloudflare-First Architecture

### Edge Computing Principles
- **Compute at the edge**: Move logic close to users
- **Minimize round trips**: Batch operations when possible
- **Cache aggressively**: Use KV for frequently accessed data
- **Optimize for cold starts**: Keep worker bundles small

### D1 Database Best Practices
```typescript
// Always use prepared statements
const stmt = env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId);

// Batch operations for efficiency
const batch = await env.DB.batch([
  stmt1.bind(param1),
  stmt2.bind(param2)
]);

// Use transactions for data integrity
await env.DB.exec(`
  BEGIN TRANSACTION;
  INSERT INTO ...;
  UPDATE ...;
  COMMIT;
`);
```

### KV Storage Patterns
```typescript
// Use KV for session storage
await env.KV.put(`session:${sessionId}`, JSON.stringify(data), {
  expirationTtl: 86400 // 24 hours
});

// Implement cache-aside pattern
let data = await env.KV.get(key, 'json');
if (!data) {
  data = await fetchFromD1();
  await env.KV.put(key, JSON.stringify(data), { expirationTtl: 3600 });
}
```

### R2 Object Storage
```typescript
// Generate presigned URLs for secure access
const url = await env.R2.createSignedUrl(key, { expiresIn: 3600 });

// Stream large files efficiently
const object = await env.R2.get(key);
return new Response(object.body, {
  headers: { 'Content-Type': object.httpMetadata.contentType }
});
```

## SvelteKit Patterns

### Data Loading Strategy
```typescript
// Use server-side loading for sensitive data
export async function load({ platform }) {
  const data = await platform.env.DB.prepare('SELECT ...').all();
  return {
    posts: data.results
  };
}
```

### Form Actions Best Practice
```typescript
// Prefer form actions over API routes
export const actions = {
  default: async ({ request, platform }) => {
    const data = await request.formData();
    // Process with Cloudflare services
    await platform.env.DB.prepare('INSERT ...').bind(...).run();
    return { success: true };
  }
};
```

### Progressive Enhancement
```svelte
<!-- Forms work without JavaScript -->
<form method="POST" use:enhance>
  <input name="email" type="email" required>
  <button>Submit</button>
</form>

<script>
  import { enhance } from '$app/forms';
</script>
```

### State Management
```typescript
// Use Svelte 5 runes for reactive state
let count = $state(0);
let doubled = $derived(count * 2);

// Share state via context API
import { setContext, getContext } from 'svelte';
setContext('user', userState);
```

## Performance Optimization

### Bundle Size Management
- Lazy load heavy components
- Use dynamic imports for routes
- Tree-shake unused code
- Optimize images with Cloudflare Images

### Caching Strategy
```typescript
// Implement stale-while-revalidate
export async function GET({ platform, setHeaders }) {
  setHeaders({
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
  });
  
  return json(await fetchData(platform));
}
```

### Error Handling
```typescript
// Comprehensive error boundaries
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  try {
    const data = await fetchData(params.id);
    if (!data) error(404, 'Not found');
    return { data };
  } catch (e) {
    error(500, 'Internal server error');
  }
}
```

## Security Best Practices

### Input Validation
- Validate all user input on the server
- Use Zod or similar for schema validation
- Sanitize HTML content
- Implement rate limiting

### Authentication Pattern
```typescript
// Use cookies for auth tokens
import { jwt } from '@tsndr/cloudflare-worker-jwt';

export async function handle({ event, resolve }) {
  const token = event.cookies.get('session');
  if (token) {
    const isValid = await jwt.verify(token, event.platform.env.JWT_SECRET);
    if (isValid) {
      event.locals.user = jwt.decode(token).payload;
    }
  }
  return resolve(event);
}
```

## Testing Strategy

### Unit Testing with Vitest
```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';

describe('Component', () => {
  it('renders correctly', () => {
    const { getByText } = render(Component);
    expect(getByText('Hello')).toBeTruthy();
  });
});
```

### E2E Testing with Playwright
```typescript
import { test, expect } from '@playwright/test';

test('user can submit form', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
  await expect(page.locator('.success')).toBeVisible();
});
```

## Code Organization

### Project Structure
```
src/
├── routes/          # SvelteKit routes
│   ├── api/        # API endpoints (if needed)
│   └── (app)/      # App routes with layout
├── lib/
│   ├── components/  # Reusable Svelte components
│   ├── server/      # Server-only utilities
│   ├── stores/      # Svelte stores (if needed)
│   └── utils/       # Shared utilities
├── app.d.ts         # TypeScript definitions
└── hooks.server.ts  # Server hooks
```

### Naming Conventions
- Components: PascalCase (`UserProfile.svelte`)
- Utilities: camelCase (`formatDate.ts`)
- Routes: kebab-case (`user-profile/+page.svelte`)
- Environment variables: UPPER_SNAKE_CASE

## Documentation Standards

### Component Documentation
```svelte
<!--
  @component UserProfile
  Displays user profile information with avatar and stats
  
  @param {User} user - User object with profile data
  @param {boolean} [editable=false] - Enable edit mode
-->
```

### Function Documentation
```typescript
/**
 * Fetches user data from D1 database
 * @param {string} userId - The user's unique identifier
 * @returns {Promise<User|null>} User object or null if not found
 * @throws {Error} If database connection fails
 */
async function getUser(userId: string): Promise<User | null> {
  // Implementation
}
```

## Deployment Checklist

- [ ] Environment variables configured in Cloudflare dashboard
- [ ] D1 database migrations run
- [ ] KV namespaces created and bound
- [ ] R2 buckets configured
- [ ] Custom domains configured
- [ ] SSL certificates active
- [ ] WAF rules configured
- [ ] Rate limiting enabled
- [ ] Error tracking connected
- [ ] Analytics enabled
