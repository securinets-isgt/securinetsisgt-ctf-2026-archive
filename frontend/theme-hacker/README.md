# Batman/Riddler Dual-Theme for CTFd

A cyberpunk CTFd theme inspired by Batman and The Riddler, featuring dual-mode switching with matrix rain hero section, neon glow effects, and monospace typography.

## Features

- **Dual Theme Modes**: Toggle between Riddler (neon green) and Batman (neon red) aesthetics
- **Matrix Rain Hero**: Full-screen canvas with falling characters animation
- **Dynamic Logo Watermark**: Logo changes with theme, appears as large blurred background element
- **Neon Glow Effects**: All UI elements have colored glow matching active theme
- **Monospace Typography**: Space Mono font throughout for hacker aesthetic
- **Floating Question Marks**: Animated scattered `?` in hero section
- **Typewriter Animation**: Hero title types out letter by letter on load
- **Dark Mode Only**: Pure black backgrounds with high-contrast neon accents
- **Theme Persistence**: User's theme choice saved in localStorage
- **Fully Responsive**: Bootstrap 5 grid for mobile compatibility

## Screenshot

![Riddler Mode](riddler-mode.png)
![Batman Mode](batman-mode.png)

## Prerequisites

- CTFd 4.x or later
- Node.js 16+ and npm
- Python 3.9+

## Installation

### 1. Add Logo Images

Place your logo PNG files in the theme's static image directory:

```bash
CTFd/themes/hacker/static/img/
├── riddler-logo.png    # Riddler logo (green theme)
└── batman-logo.png    # Batman logo (red theme)
```

**Logo Guidelines:**
- Transparent background PNG recommended
- Minimum 200x200px, preferably 500x500px for hero watermark
- High contrast for visibility on dark background

### 2. Install Dependencies & Build

```bash
cd "/path/to/CTFd/CTFd/themes/hacker"
npm install
npm run build
```

For development (auto-rebuild on changes):
```bash
npm run dev
```

### 3. Activate the Theme

1. Start CTFd:
```bash
cd "/path/to/CTFd"
python serve.py
```

2. Log in as admin → Admin Panel → Config → Theme
3. Select **"hacker"** from dropdown
4. Save and refresh

## Theme Switching

### Navbar Button

The navbar includes a theme toggle button that cycles between modes:
- **Riddler Mode**: Shows "🦇 Switch to Batman"
- **Batman Mode**: Shows "❓ Switch to Riddler"

Click to toggle instantly.

### Storage

The current theme is stored in `localStorage` under key `ctf-theme` and persists across sessions.

### Default

First-time visitors see **Riddler Mode** (neon green) by default.

## Color Schemes

### Riddler Theme (Green)
```css
--accent: #00ff41;
--accent-rgb: 0, 255, 65;
--glow: rgba(0, 255, 65, 0.4);
```

### Batman Theme (Red)
```css
--accent: #e60000;
--accent-rgb: 230, 0, 0;
--glow: rgba(230, 0, 0, 0.4);
```

## File Structure

```
hacker/
├── assets/
│   ├── scss/
│   │   ├── main.scss               # All theme styles (uses CSS variables)
│   │   ├── theme-variables.scss    # CSS custom properties for dual-theme
│   │   └── includes/
│   │       ├── components/
│   │       │   ├── _challenge.scss    # Challenge card styles
│   │       │   ├── _jumbotron.scss    # Hero/jumbotron styles
│   │       │   ├── _table.scss        # Scoreboard table styles
│   │       │   └── _sticky-footer.scss
│   │       ├── icons/
│   │       └── utils/
│   │           ├── _fonts.scss        # Monospace font config
│   │           ├── _variables.scss    # Fallback SCSS variables (legacy)
│   │           └── ...
│   ├── js/
│   │   ├── theme-toggle.js          # Theme persistence & switching logic
│   │   ├── matrix-rain.js           # Canvas matrix rain animation
│   │   └── ...                      # Other CTFd JS files
│   └── static/                      # Built assets (after npm run build)
│       └── assets/
│           ├── main.[hash].css
│           └── ...
├── templates/
│   ├── base.html                    # Base template with data-theme attr
│   ├── index.html                   # Homepage with hero matrix rain
│   ├── challenges.html              # Challenge listing (auto-themed)
│   ├── scoreboard.html              # Leaderboard (auto-themed)
│   ├── login.html                   # Login form (card style)
│   ├── register.html                # Registration form (card style)
│   └── components/
│       ├── navbar.html              # Nav with logo + toggle
│       ├── snackbar.html
│       ├── notifications.html
│       └── errors.html
└── static/                          # Theme static files (after build)
    ├── assets/
    ├── img/                         # Place riddler-logo.png, batman-logo.png here
    └── webfonts/                    # FontAwesome fonts (copied by build)

package.json
vite.config.js
README.md
```

## JavaScript Modules

### theme-toggle.js

Handles theme persistence and switching:

- Reads/writes `localStorage` key `ctf-theme`
- Sets `data-theme` attribute on `<html>` element
- Swaps navbar logo and hero watermark images
- Updates toggle button text
- Dispatches `themechange` custom event
- Exposes `window.ThemeManager` API:

```js
ThemeManager.setTheme('riddler');  // or 'batman'
ThemeManager.getTheme();           // returns current theme
ThemeManager.toggle();             // toggle manually
```

### matrix-rain.js

Canvas animation rendering falling characters:

- Uses characters: `?01ABCDEF#@!<>`
- Reads accent color from `window.ACCENT_RGB` (set by theme-toggle)
- Responds to `themechange` events to update color in real-time
- Exposes `window.MatrixRain` API: `start()`, `stop()`, `setAccentColor(rgb)`

## CSS Custom Properties

Theme colors are controlled via CSS variables:

```css
[data-theme="riddler"] {
  --accent: #00ff41;
  --accent-rgb: 0, 255, 65;
  --glow: rgba(0, 255, 65, 0.4);
}

[data-theme="batman"] {
  --accent: #e60000;
  --accent-rgb: 230, 0, 0;
  --glow: rgba(230, 0, 0, 0.4);
}

/* Base variables (also switch via theme) */
:root {
  --bg-deep: #000000;
  --bg-card: #0f0f0f;
  --bg-hover: #1a1a1a;
  --border-dark: #2a2a2a;
  --text-dim: #8a8a8a;
  --text-bright: #e0e0e0;
}
```

These variables are used throughout `main.scss` for all component styling.

## Customization

### Change Colors

Edit `assets/scss/theme-variables.scss` to modify the color palettes.

Then rebuild:
```bash
npm run build
```

### Modify Matrix Rain

Adjust `assets/js/matrix-rain.js`:
- Character set: `CHARACTERS` constant
- Speed: `FALL_SPEED_MS` (default 55ms)
- Opacity: `OPACITY_BASE` (default 0.07)
- Font size: `FONT_SIZE` (default 14px)

### Adjust Hero Section

Edit `templates/index.html`:
- Logo size: inline `width: 500px`
- Floating `?` positions and sizes (look for `.floating-questions` spans)
- Stats numbers and labels
- Typewriter text strings

### Animations

Keyframes defined in `main.scss`:
- `grid-pulse`: Background grid opacity breathing
- `pulse`: Floating question mark opacity/scale
- `bounce`: Scroll indicator
- `fadeIn`: General fade in

Speeds can be adjusted inline in `index.html`.

## Browser Compatibility

- Chrome/Edge: Full support (CSS filters, animations, backdrop-filter)
- Firefox: Full support (CSS filters, animations)
- Safari: Full support (may have limited scrollbar styling)
- Mobile: Fully responsive

## Development Tips

1. **Hot Reload**: Run `npm run dev` while developing to auto-rebuild on file changes
2. **Cache Busting**: Built assets include content hash in filename (e.g., `main.[hash].css`)
3. **Theme Switching**: Clear `localStorage` to reset to default:
   ```js
   localStorage.removeItem('ctf-theme');
   location.reload();
   ```
4. **Missing Logos**: If logo images are not present, the `<img>` will be broken. Check browser console for 404s. Place PNG files in `static/img/` and rebuild.

## Implementation Details

### Matrix Rain Canvas

The canvas fills the entire hero section and renders columns of falling characters. Each column:
- Random start Y position above canvas
- Random speed (1-3 units)
- 10–30 character length with trailing fade

Performance: Uses `requestAnimationFrame` for smooth 60fps animation. The trailing effect is achieved by drawing semi-transparent black over the canvas each frame instead of clearing completely.

### Typewriter Effect

Pure JavaScript in `index.html` block animates two lines:
1. "Securinets ISGT" appears after 400ms delay, 60ms per character
2. "CTF" appears immediately after line 1 completes

Can be customized by editing the script block at the bottom of `index.html`.

### Logo Watermark

The logo image appears in both the navbar (small) and hero (large, blurred). Both update instantly when theme toggles. The hero logo uses CSS mix-blend-mode: screen for subtle integration.

## Troubleshooting

**Theme not switching?**
- Ensure `theme-toggle.js` is loaded (check Network tab)
- Verify `data-theme` attribute appears on `<html>` after click
- Check console for JavaScript errors

**Matrix rain not appearing?**
- Canvas requires the element with id `matrix-rain-canvas` to exist (in index.html)
- Ensure `matrix-rain.js` is loaded after DOM
- Check that `window.ACCENT_RGB` is set (should be by theme-toggle)

**Logos broken?**
- Confirm `static/img/riddler-logo.png` and `batman-logo.png` exist
- Paths in `theme-toggle.js` must match: `/themes/hacker/static/img/riddler-logo.png`
- Run `npm run build` after adding images to copy them to `static/` (if using Vite assets)

**CSS not applying?**
- Build generated assets: `static/assets/main.[hash].css` should exist
- Check that `{{ Assets.css("assets/scss/main.scss") }}` is in base.html (it is)
- Verify the CSS file includes your changes (Inspect → Styles → look for `--accent` usage)

## Credits

- Inspired by Batman & The Riddler aesthetics
- Fonts: [Space Mono](https://fonts.google.com/specimen/Space+Mono) by Google Fonts
- Icons: [FontAwesome](https://fontawesome.com/)
- Framework: [Bootstrap 5](https://getbootstrap.com/)
- Based on CTFd Core Theme

## License

Apache 2.0 (same as CTFd)
