# HTML Style Guide

## Core Principles

### Semantic HTML First
- Use semantic elements for meaning, not appearance
- Choose elements based on content structure and purpose
- Ensure logical document outline with proper heading hierarchy

### Accessibility Standards
- Include proper ARIA labels and roles where needed
- Ensure keyboard navigation support
- Provide alternative text for images
- Use sufficient color contrast
- Structure forms with proper labels and associations

## Structure Rules

### Indentation and Formatting
- Use 2 spaces for indentation (consistent with project standards)
- Place nested elements on new lines with proper indentation
- Content between tags should be on its own line when multi-line
- Close tags immediately after content for single-line elements

### Document Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Descriptive Page Title</title>
</head>
<body>
  <header role="banner">
    <!-- Site header content -->
  </header>

  <main role="main">
    <!-- Primary content -->
  </main>

  <footer role="contentinfo">
    <!-- Site footer content -->
  </footer>
</body>
</html>
```

## Semantic Element Usage

### Content Sectioning
```html
<!-- Use semantic containers -->
<header>        <!-- Site/section header -->
<nav>           <!-- Navigation links -->
<main>          <!-- Primary content -->
<section>       <!-- Distinct content section -->
<article>       <!-- Standalone content -->
<aside>         <!-- Sidebar content -->
<footer>        <!-- Site/section footer -->
```

### Text Content
```html
<!-- Proper heading hierarchy -->
<h1>Page Title</h1>
  <h2>Section Title</h2>
    <h3>Subsection Title</h3>

<!-- Text semantics -->
<p>Paragraph content with <strong>importance</strong> and <em>emphasis</em></p>
<blockquote cite="source-url">
  <p>Quoted content</p>
  <cite>Source attribution</cite>
</blockquote>
```

### Lists and Navigation
```html
<!-- Unordered lists for related items -->
<ul>
  <li>List item one</li>
  <li>List item two</li>
</ul>

<!-- Ordered lists for sequential content -->
<ol>
  <li>Step one</li>
  <li>Step two</li>
</ol>

<!-- Navigation with semantic structure -->
<nav aria-label="Main navigation">
  <ul role="list">
    <li><a href="/" aria-current="page">Home</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>
```

## Attribute Formatting

### Multi-line Attribute Rules
- Place each HTML attribute on its own line for complex elements
- Align attributes vertically for readability
- Keep the closing `>` on the same line as the last attribute
- Group related attributes together

### Attribute Order
1. Structural attributes (`id`, `class`)
2. Semantic attributes (`role`, `aria-*`)
3. Interactive attributes (`href`, `onclick`, `disabled`)
4. Data attributes (`data-*`)
5. Styling attributes (avoid inline styles)

```html
<button id="submit-btn"
        class="btn btn-primary"
        type="submit"
        aria-label="Submit form"
        disabled
        data-analytics="form-submit">
  Submit
</button>
```

## Form Structure

### Accessible Forms
```html
<form action="/submit" method="POST" novalidate>
  <fieldset>
    <legend>Personal Information</legend>

    <div class="form-field">
      <label for="full-name">Full Name *</label>
      <input id="full-name"
             name="fullName"
             type="text"
             required
             aria-describedby="name-error"
             aria-invalid="false">
      <div id="name-error" class="error-message" role="alert">
        <!-- Error message appears here -->
      </div>
    </div>

    <div class="form-field">
      <label for="email">Email Address *</label>
      <input id="email"
             name="email"
             type="email"
             required
             aria-describedby="email-help email-error">
      <div id="email-help" class="help-text">
        We'll never share your email
      </div>
      <div id="email-error" class="error-message" role="alert">
        <!-- Error message appears here -->
      </div>
    </div>
  </fieldset>

  <button type="submit">Submit Form</button>
</form>
```

### Select and Option Groups
```html
<div class="form-field">
  <label for="country">Country</label>
  <select id="country" name="country" required>
    <option value="">Choose a country</option>
    <optgroup label="North America">
      <option value="us">United States</option>
      <option value="ca">Canada</option>
    </optgroup>
    <optgroup label="Europe">
      <option value="uk">United Kingdom</option>
      <option value="de">Germany</option>
    </optgroup>
  </select>
</div>
```

## Media and Interactive Elements

### Images with Proper Alt Text
```html
<!-- Descriptive images -->
<img src="/assets/product-hero.jpg"
     alt="Modern laptop displaying analytics dashboard"
     width="800"
     height="450"
     loading="lazy">

<!-- Decorative images -->
<img src="/assets/decorative-pattern.svg"
     alt=""
     role="presentation"
     width="200"
     height="100">

<!-- Images with captions -->
<figure>
  <img src="/assets/chart.png"
       alt="Sales increased 40% from Q1 to Q2">
  <figcaption>
    Quarterly sales growth chart showing 40% increase
  </figcaption>
</figure>
```

### Interactive Elements
```html
<!-- Buttons with clear purposes -->
<button type="button"
        class="btn-secondary"
        aria-expanded="false"
        aria-controls="mobile-menu">
  <span class="sr-only">Toggle</span>
  Menu
</button>

<!-- Links with descriptive text -->
<a href="/documentation"
   class="link-primary"
   aria-describedby="docs-description">
  View Documentation
</a>
<div id="docs-description" class="sr-only">
  Opens comprehensive API documentation in new tab
</div>
```

## Example Complete Structure

```html
<div class="container">
  <header class="site-header
                 flex flex-col space-y-2
                 md:flex-row md:space-y-0 md:space-x-4"
          role="banner">
    <h1 class="site-title
               text-primary dark:text-primary-300">
      <a href="/" class="no-underline">
        Site Name
      </a>
    </h1>

    <nav class="main-navigation
                flex flex-col space-y-2
                md:flex-row md:space-y-0 md:space-x-4"
         aria-label="Main navigation">
      <ul role="list" class="nav-list">
        <li>
          <a href="/"
             class="nav-link btn-ghost"
             aria-current="page">
            Home
          </a>
        </li>
        <li>
          <a href="/about"
             class="nav-link btn-ghost">
            About
          </a>
        </li>
        <li>
          <a href="/contact"
             class="nav-link btn-ghost">
            Contact
          </a>
        </li>
      </ul>
    </nav>
  </header>

  <main role="main" class="main-content">
    <section class="hero-section">
      <h2>Welcome to Our Site</h2>
      <p>Descriptive content about the site's purpose</p>
    </section>
  </main>

  <footer role="contentinfo" class="site-footer">
    <p>&copy; 2024 Site Name. All rights reserved.</p>
  </footer>
</div>
```

## Best Practices Summary

### DO:
- Use semantic HTML elements for their intended purpose
- Include proper ARIA labels and roles for accessibility
- Structure forms with fieldsets, legends, and proper labels
- Provide meaningful alt text for images
- Use proper heading hierarchy (h1 → h2 → h3)
- Include skip links for keyboard navigation
- Test with screen readers and keyboard-only navigation

### DON'T:
- Use `div` and `span` when semantic elements exist
- Rely solely on color to convey information
- Create inaccessible custom components without proper ARIA
- Use placeholder text as labels
- Skip heading levels (h1 → h3)
- Remove focus indicators without providing alternatives

## Framework Integration Notes

This guide applies to raw HTML. When using frameworks like Svelte:
- Adapt patterns to framework syntax (e.g., `class=` vs `className`)
- Maintain semantic structure within component boundaries
- Use framework-specific accessibility features when available
- Reference the Svelte Style Guide for framework-specific patterns
