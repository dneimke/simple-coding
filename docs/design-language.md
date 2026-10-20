# Design Language

The Field Hockey Event Tracker uses one small design language across the Event Capture app (`src/index.html`) and Match Review (`src/timeline-video.html`). Read this before adding a screen, a component or a colour. Everything here lives in [`src/styles.css`](../src/styles.css).

## Principles

1. **Sideline first.** The capture screen is used one-handed on a phone or iPad during a match. Every tappable control is at least `--touch-min` (44px) high, and event buttons stay high-contrast.
2. **Light and calm.** Light canvas, white surfaces, one dark navigation bar, one blue accent. Colour carries meaning: board colours, team colours, and status.
3. **Tokens, not hex values.** Colours, spacing, radius, shadow and type come from CSS custom properties on `:root`. New CSS uses `var(--token)`; it never introduces a new hex value unless it adds a token first.
4. **Semantic classes for look, Tailwind for layout.** Compose the classes below for colour, borders, elevation and type. Use Tailwind utilities only for layout and spacing (`flex`, `grid`, `gap-*`, `mt-*`, `hidden`, responsive prefixes). Don't write `bg-blue-600` or `text-gray-700` in new markup or JavaScript.
5. **Mobile first.** Write the phone layout, then add `min-width` media queries (or `md:` / `lg:` utilities) for larger screens.

## Breakpoints

| Name   | Width     | Typical device   |
| ------ | --------- | ---------------- |
| phone  | < 640px   | Phone portrait   |
| sm     | >= 640px  | Large phone      |
| md     | >= 768px  | iPad portrait    |
| lg     | >= 1024px | iPad landscape, laptop |

These match Tailwind's `sm`, `md` and `lg`. `--page-pad` grows from 12px to 20px (md) to 32px (lg).

## Tokens

| Group      | Tokens |
| ---------- | ------ |
| Surfaces   | `--color-canvas`, `--color-surface`, `--color-surface-muted`, `--color-line`, `--color-line-strong` |
| Text       | `--color-ink`, `--color-ink-soft`, `--color-muted` |
| Accent     | `--color-accent`, `--color-accent-hover`, `--color-accent-soft`, `--color-accent-ring`, `--focus-ring` |
| Navigation | `--color-nav`, `--color-nav-ink`, `--color-nav-ink-active`, `--color-nav-hover`, `--color-nav-active` |
| Status     | `--color-success*`, `--color-warning*`, `--color-danger*` (each has base, `-hover`, `-soft`, `-ink`) |
| Spacing    | `--space-1` (4px), `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), `--space-5` (20px), `--space-6` (24px), `--space-8` (32px) |
| Shape      | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-full` |
| Depth      | `--shadow-sm` (resting surfaces), `--shadow-md` (hover, raised), `--shadow-lg` (modals) |
| Type       | `--font-sans` (Inter), `--font-mono` (timer, XML, JSON) |
| Layout     | `--touch-min`, `--content-max`, `--page-pad`, `--nav-height` |

## Class catalog

### Shell

| Class | Use |
| ----- | --- |
| `app-shell` | Wraps the whole page (on `<body>`'s first child). Column flex, full height. |
| `app-nav`, `app-nav-inner`, `app-nav-bar` | Dark top bar and its centred content. |
| `app-brand`, `app-brand-mark` | Product name and icon tile in the bar. |
| `app-nav-icon-button` | Icon-only control in the bar (menu toggle, GitHub). |
| `nav-link`, `nav-link-active` | Navigation items. The router toggles `nav-link-active`. |
| `app-main` | The flexible content region under the nav. |
| `page` | Centred content column, max `--content-max`, padded with `--page-pad`. |
| `page-header`, `page-title`, `page-subtitle` | Heading row at the top of every view. Actions go inside `page-header` on the right. |
| `section-title`, `help-text`, `text-muted`, `empty-state` | Secondary text styles. |

### Surfaces and feedback

| Class | Use |
| ----- | --- |
| `surface` | White card: border, `--radius-lg`, `--shadow-sm`. Add `surface-padded` for standard padding. |
| `surface-muted` | Tinted inset area inside a surface. |
| `banner` + `banner-info` / `banner-success` / `banner-warning` / `banner-error` | Inline message strip. |
| `config-message` + `config-success` / `config-error` | Form result message (Configure). |
| `modal` + `modal-panel`, `modal-title`, `modal-actions` | Overlay dialog. Bottom sheet on phone, centred from `sm`. Toggle with `hidden`. |
| `link-button` | Text button styled as a link. |

### Controls

| Class | Use |
| ----- | --- |
| `btn` + `btn-primary` / `btn-secondary` / `btn-success` / `btn-warning` / `btn-danger` / `btn-ghost` / `btn-dark` | General action buttons. `btn-danger` is a quiet outlined destructive action. Add `btn-icon` for icon-only. |
| `event-button` + board colour | Big, bold buttons used on the capture board, the timer controls, and confirm actions in modals. |
| `btn-blue`, `btn-red`, `btn-green`, `btn-yellow`, `btn-orange`, `btn-gray` | Board colour names. **Part of the board JSON format; never rename.** Values come from tokens. |
| `team-color-<id>` | Team colours, one per entry in `TEAM_PALETTE` (`src/components/teamPalette.js`). Add both together. |
| `field`, `field-label`, `field-inline` | Inputs and selects. 44px tall, 16px text on phones (stops iOS zoom). |
| `tabs` + `tab-button`, `tab-button-active`, `tab-content` | Tab strip. Scrolls horizontally on narrow screens. The router toggles `tab-button-active`. |
| `segmented` | Joined pair of small toggle buttons. |

### Feature classes

Feature areas own their own classes, built from tokens: `capture-toolbar`, `capture-timer`, `capture-actions`, `capture-meta`, `last-event-bar`, `group-container`, `zone-*`, `team-*`, `swatch`, `config-editor*`, `saved-games-list`, `saved-game-*`, `review-*`, `xml-*`.

Match Review (`body.review-page`) uses the full viewport. `review-header` / `review-game-title` is the one-line match name above the workspace. `review-layout` places `review-timeline` beside `review-video`; from the `md` breakpoint the video stage (`review-video-stage`) fills the leftover height. Saved tags are `timeline-event` rows (`timeline-event-seek`, `timeline-event-time`, `timeline-event-name`, `timeline-event-action`). Active filters use `filter-tag` / `filter-tag-remove`. Add tag sits in `review-video-actions`, in the toolbar.

### JavaScript helpers

`src/components/ui/` emits the same classes, so JavaScript-built UI matches the markup:

- `createButton({ type })` maps `type` to `btn btn-<type>` (`primary`, `secondary`, `success`, `warning`, `danger`, `ghost`; anything else is `secondary`).
- `createCard()` returns a `surface`.
- `createGameCard()` returns a `saved-game-card` whose `saved-game-actions` row holds a primary Review button and a `saved-game-more` overflow menu (`saved-game-menu`, `saved-game-menu-item`, `saved-game-menu-item-danger`) for the secondary actions.

## Recipes

### A new view

```html
<div id="help-view" class="hidden">
    <header class="page-header">
        <div>
            <h1 class="page-title">Help</h1>
            <p class="page-subtitle">How to code a match</p>
        </div>
        <button type="button" class="btn btn-secondary">Print</button>
    </header>
    <section class="surface surface-padded">
        <h2 class="section-title">Getting started</h2>
        <p class="help-text">...</p>
    </section>
</div>
```

Views sit inside `<main class="app-main"><div class="page">`. Register them with the router as described in [Developer Guide](developer-guide.md#working-with-the-router).

### A form row

```html
<div class="mb-4">
    <label for="teamName" class="field-label">Team name</label>
    <input id="teamName" type="text" class="field">
</div>
```

### A dialog

```html
<div id="exampleModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="exampleTitle">
    <div class="modal-panel">
        <h2 id="exampleTitle" class="modal-title">Title</h2>
        <p class="help-text">Body</p>
        <div class="modal-actions">
            <button type="button" class="btn btn-secondary">Cancel</button>
            <button type="button" class="btn btn-primary">Confirm</button>
        </div>
    </div>
</div>
```

### A new colour or component

1. If no token fits, add one to `:root` in `styles.css` under the right group, and list it in the table above.
2. Add the component class under a `/* ===== Section ===== */` heading in `styles.css`, using only tokens.
3. If the component sets `display`, add a `.your-class.hidden { display: none; }` rule, because Tailwind's `.hidden` has the same specificity and can lose.
4. Document the class in the catalog above.

## Checklist for UI changes

- Check the layout at about 390px (phone), 768px (iPad) and 1280px (laptop).
- Tappable controls are at least 44px high on touch screens.
- Keyboard focus is visible (`--focus-ring`).
- No new hex colours or Tailwind colour utilities outside `styles.css`.
- Event Capture keeps its bottom padding so the nav can scroll off screen while coding.
