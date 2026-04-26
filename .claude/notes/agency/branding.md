# Agency Branding — Reference

## Brand Colors

Agencies can customize:
- `primaryColor` — main brand color (buttons, links)
- `secondaryColor` — light background color
- `accentColor` — accent/highlight color
- `accentGradient` — CSS gradient for premium effects (optional)
- `logoUrl` — agency logo (URL or base64 data URL)

## Gradient Support

The `accentGradient` field stores a complete CSS gradient string:

```sql
-- Example value
'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
```

Used in proposals and UI elements. Falls back to `accentColor` when not set.

## Files

- `apps/service-client/src/routes/(app)/[agencySlug]/settings/branding/+page.svelte` — branding settings UI
- `apps/service-client/src/lib/api/agency-profile.remote.ts` — save branding data
