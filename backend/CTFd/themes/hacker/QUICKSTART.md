# Quick Start Guide — Batman/Riddler Theme

## Setup Checklist

### 1. Add Logo Images (Required)

Copy your PNG logo files to:
```
CTFd/themes/hacker/static/img/
├── riddler-logo.png    (Riddler/Green theme)
└── batman-logo.png    (Batman/Red theme)
```

If you don't have these yet, you can temporarily rename any test PNG to these filenames.

### 2. Build Theme Assets

```bash
cd "/mnt/c/Users/hilmi/Desktop/club/battheme/ctf platform/CTFd/CTFd/themes/hacker"
npm install          # First time only
npm run build        # Production build
# or: npm run dev    # Development (auto-rebuild)
```

Expected output: `static/assets/main.[hash].css` and JS files.

### 3. Activate Theme in CTFd

Start CTFd:
```bash
cd "/mnt/c/Users/hilmi/Desktop/club/battheme/ctf platform/CTFd"
python serve.py
```

Log into admin panel → **Admin Panel → Config → Theme** → select **"hacker"** → Save.

### 4. Set Homepage (if needed)

If you want the Matrix Rain hero on the homepage:

1. In Admin Panel → Pages → Create New Page (or edit existing `/` route)
2. Title: "Home"
3. Route: `/`
4. Template: **index** (select from dropdown)
5. Content: leave empty or add supplemental content
6. Save

Refresh the homepage — you should see the full hero with matrix rain.

## Verify Installation

1. **Open homepage**: Should see matrix rain, logo watermark, floating `?`, and title animation
2. **Check navbar**: Riddler logo should appear on left, theme toggle button on right
3. **Click theme toggle**: Should switch to Batman red theme instantly
   - Navbar logo changes to Batman
   - Hero logo watermark changes
   - Matrix rain color changes from green to red
   - All accent colors update
4. **Refresh page**: Theme should persist (check localStorage `ctf-theme`)
5. **Visit other pages**: Challenges, Scoreboard, Login should all have themed styling

## File Overview

```
CTFd/themes/hacker/
├── assets/
│   ├── scss/
│   │   ├── main.scss               ← Main styles (built to CSS)
│   │   ├── theme-variables.scss    ← CSS custom properties
│   │   └── includes/
│   │       ├── components/
│   │       │   ├── _challenge.scss
│   │       │   ├── _table.scss
│   │       │   └── ...
│   │       └── utils/
│   │           ├── _fonts.scss
│   │           └── _variables.scss
│   ├── js/
│   │   ├── theme-toggle.js         ← Theme switching logic
│   │   ├── matrix-rain.js          ← Matrix animation
│   │   └── ...                     (other CTFd JS)
│   └── sounds/                     (notification sounds)
├── templates/
│   ├── base.html                   ← Base template (data-theme, fonts)
│   ├── index.html                  ← Homepage with hero
│   ├── challenges.html             ← Challenge listing
│   ├── scoreboard.html             ← Leaderboard
│   ├── login.html                  ← Login page (card)
│   ├── register.html               ← Register page (card)
│   └── components/
│       └── navbar.html             ← Navbar with toggle
└── static/                         ← Built assets (auto-generated)
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Matrix rain not visible | Check Console for errors. Ensure `matrix-rain.js` loaded and `#matrix-rain-canvas` exists |
| Theme toggle button missing | Check navbar.html contains `<button class="theme-switch">` |
| Colors not switching | Verify `data-theme` attribute on `<html>` changes on click |
| Logos show broken | Add `riddler-logo.png` and `batman-logo.png` to `static/img/` |
| CSS not applied | Confirm `main.[hash].css` exists in `static/assets/` and is referenced in base.html |
| Theme not persisting | Check browser localStorage for `ctf-theme` key; may be blocked in private mode |

## Customization Quick Reference

| What to change | Where |
|----------------|-------|
| Accent colors (green/red) | `assets/scss/theme-variables.scss` |
| Hero title text | `templates/index.html` (search for "Securinets ISGT") |
| Font family | `templates/base.html` (Google Fonts link) and `assets/scss/includes/utils/_fonts.scss` |
| Matrix rain speed | `assets/js/matrix-rain.js` → `FALL_SPEED_MS` |
| Logo images | `static/img/riddler-logo.png` and `batman-logo.png` |
| Animation durations | Inline in `templates/index.html` (e.g., `animation: fadeIn 1s`) |

## Next Steps

- [ ] Add your actual Batman and Riddler logo PNGs
- [ ] Test theme toggle on all pages
- [ ] Customize hero text and stats to match your CTF
- [ ] Adjust colors in `theme-variables.scss` if needed
- [ ] Build and deploy to production

Enjoy your Batman-themed CTF platform! 🦇
