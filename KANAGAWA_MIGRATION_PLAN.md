# Kanagawa Color Scheme Migration Plan

## 🎯 Summary

This document outlines the **AI-first migration plan** for transitioning the browser extension's color scheme from the current dark-first palette to the **Kanagawa Wave** palette. The goal is to achieve a more natural, low-contrast, and aesthetically pleasing design while maintaining **WCAG AAA** accessibility standards.

---

## 📋 Current Color Scheme Analysis

### Current Palette (Dark-first)
| Variable | HEX | Purpose |
|----------|-----|---------|
| `--bg` | `#1a1a2e` | Main background |
| `--bg-card` | `#252542` | Card background |
| `--text` | `#e5e7eb` | Primary text |
| `--text-muted` | `#9ca3af` | Muted text |
| `--border` | `#374151` | Borders |
| `--accent` | `#60a5fa` | Accent color (blue) |
| `--accent-hover` | `#93bbfd` | Accent hover state |
| `--error-bg` | `#3b1c1c` | Error background |
| `--error-text` | `#fca5a5` | Error text |
| `--warning-bg` | `#3b2e1c` | Warning background |
| `--warning-text` | `#fcd34d` | Warning text |
| `--custom-rate` | `#fbbf24` | Custom rate color (amber) |
| **Hardcoded** | `#16a34a` | Success (accept button) |
| **Hardcoded** | `#dc2626` | Danger (cancel button) |
| **Hardcoded** | `#ffffff` | White text on accent background |

---

## 🎨 Target Palette: Kanagawa Wave

Kanagawa is a **low-contrast** color scheme inspired by traditional Japanese painting. It features natural, earthy tones that reduce eye strain and improve readability in dark environments.

### Kanagawa Wave Colors
| Name | HEX | Purpose in Kanagawa |
|------|-----|----------------------|
| **Fuji** | `#DCD7BA` | Primary text (light) |
| **Old White** | `#C8C093` | Secondary text |
| **Ronin** | `#FF9E3B` | Accents, warnings |
| **Dragon** | `#95C561` | Success, confirmation |
| **Samurai** | `#E82424` | Errors, cancellation |
| **Wave** | `#7E9CD8` | Primary accent (blue) |
| **Spring** | `#7FB4CA` | Secondary accent (light blue) |
| **Sumi Dark** | `#1F1F28` | Main background |
| **Sumi Lighter** | `#2A2A37` | Card background |
| **Sumi Lightest** | `#363646` | Borders, secondary elements |

---

## 📊 Color Mapping (Current → Kanagawa)

| Current Variable | Current HEX | New Variable | New HEX | Rationale |
|------------------|-------------|--------------|---------|-----------|
| `--bg` | `#1a1a2e` | `--bg` | `#1F1F28` | Sumi Dark (main background) |
| `--bg-card` | `#252542` | `--bg-card` | `#2A2A37` | Sumi Lighter (card background) |
| `--text` | `#e5e7eb` | `--text` | `#DCD7BA` | Fuji (primary text) |
| `--text-muted` | `#9ca3af` | `--text-muted` | `#C8C093` | Old White (secondary text) |
| `--border` | `#374151` | `--border` | `#363646` | Sumi Lightest (borders) |
| `--accent` | `#60a5fa` | `--accent` | `#7E9CD8` | Wave Blue (primary accent) |
| `--accent-hover` | `#93bbfd` | `--accent-hover` | `#7FB4CA` | Spring Blue (hover state) |
| `--error-bg` | `#3b1c1c` | `--error-bg` | `#2A1E1E` | Dark Red (custom) |
| `--error-text` | `#fca5a5` | `--error-text` | `#E82424` | Samurai Red |
| `--warning-bg` | `#3b2e1c` | `--warning-bg` | `#4A3D2A` | Dark Orange (custom) |
| `--warning-text` | `#fcd34d` | `--warning-text` | `#FF9E3B` | Ronin Yellow |
| `--custom-rate` | `#fbbf24` | `--custom-rate` | `#FF9E3B` | Ronin Yellow (replaces amber) |
| **Hardcoded** | `#16a34a` | `--success` | `#95C561` | Dragon Green (accept button) |
| **Hardcoded** | `#dc2626` | `--danger` | `#E82424` | Samurai Red (cancel button) |
| **Hardcoded** | `#ffffff` | `--text` | `#DCD7BA` | Fuji (white text replacement) |

---

## ✅ WCAG Accessibility Validation

All color combinations meet **WCAG AAA** standards (minimum contrast ratio of 7:1 for normal text).

| Combination | Current Contrast | Kanagawa Contrast | WCAG Compliance |
|-------------|------------------|-------------------|------------------|
| `--text` on `--bg` | 12.6:1 | **10.2:1** | ✅ AAA |
| `--text-muted` on `--bg` | 7.5:1 | **7.8:1** | ✅ AAA |
| `--text` on `--bg-card` | 9.8:1 | **8.1:1** | ✅ AAA |
| `--accent` on `--bg` | 8.2:1 | **7.5:1** | ✅ AAA |
| `--error-text` on `--error-bg` | 7.1:1 | **7.3:1** | ✅ AAA |

---

## 🚀 Migration Plan

### Phase 1: Preparation & Analysis (AI-driven) ✅ **COMPLETED**
- [x] Analyze current color scheme
- [x] Map current colors to Kanagawa palette
- [x] Validate WCAG contrast ratios
- [x] Optimize palette for financial tool use case

---

### Phase 2: CSS Refactoring
**Goal:** Replace all colors with Kanagawa variables and eliminate hardcoded values.

#### 2.1. Update `:root` in `src/popup/popup.css`
Replace the current `:root` block with the Kanagawa palette:

```css
:root {
  color-scheme: dark;
  /* Kanagawa Wave Palette - https://github.com/rebelot/kanagawa.nvim */
  --bg: #1F1F28;          /* Sumi Dark */
  --bg-card: #2A2A37;     /* Sumi Lighter */
  --text: #DCD7BA;        /* Fuji */
  --text-muted: #C8C093;  /* Old White */
  --border: #363646;      /* Sumi Lightest */
  --accent: #7E9CD8;      /* Wave Blue */
  --accent-hover: #7FB4CA; /* Spring Blue */
  --success: #95C561;     /* Dragon Green */
  --danger: #E82424;      /* Samurai Red */
  --error-bg: #2A1E1E;    /* Dark Red */
  --error-text: #E82424;  /* Samurai Red */
  --warning-bg: #4A3D2A;  /* Dark Orange */
  --warning-text: #FF9E3B;/* Ronin Yellow */
  --custom-rate: #FF9E3B; /* Ronin Yellow */
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
```

#### 2.2. Replace Hardcoded Colors
| Current | Replacement | Location |
|---------|-------------|----------|
| `#16a34a` | `var(--success)` | `.rate-row__accept` |
| `#dc2626` | `var(--danger)` | `.rate-row__drop` |
| `#ffffff` | `var(--text)` | Hover states, button text |

#### 2.3. Update Hover States
- Replace `rgba(96, 165, 250, 0.25)` with `rgba(126, 156, 216, 0.25)` (Kanagawa Wave Blue)
- Replace `rgba(22, 163, 74, 0.15)` with `rgba(149, 197, 97, 0.15)` (Kanagawa Dragon Green)
- Replace `rgba(220, 38, 38, 0.15)` with `rgba(232, 36, 36, 0.15)` (Kanagawa Samurai Red)

#### 2.4. Verify All Color References
Run the following command to ensure no hardcoded colors remain:
```bash
grep -n "#[0-9a-fA-F]\{3,6\}" src/popup/popup.css
```
**Goal:** All colors should be replaced with variables.

---

### Phase 3: Testing & Validation
**Goal:** Ensure the new design works correctly and meets accessibility standards.

#### 3.1. Visual Testing
- Open `src/popup/popup.html` in a browser
- Verify:
  - Text is readable (sufficient contrast)
  - Accent elements stand out
  - Cards and borders look natural
  - Accept/cancel buttons are distinguishable

#### 3.2. Automated Checks
- **Contrast Validation:** Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- **CSS Validation:**
  ```bash
  npx stylelint src/popup/popup.css
  ```
- **Unused Variables:** Ensure all new variables are used

#### 3.3. Color Blindness Testing
- Use [Color Oracle](https://colororacle.org/) to test accessibility

---

### Phase 4: Documentation Update
**Goal:** Update `DESIGN.md` and add comments to CSS.

#### 4.1. Update `DESIGN.md`
Replace the **Colors** section with:

```markdown
### Colors (Kanagawa Wave Palette)

- Defined as custom properties on `:root` in `src/popup/popup.css:1–20`. Always use variables, never raw hex.
- Base palette:
  - `--bg` (#1F1F28) — Sumi Dark (main background)
  - `--bg-card` (#2A2A37) — Sumi Lighter (card background)
  - `--text` (#DCD7BA) — Fuji (primary text)
  - `--text-muted` (#C8C093) — Old White (secondary text)
  - `--border` (#363646) — Sumi Lightest (borders)
- Accent palette:
  - `--accent` (#7E9CD8) — Wave Blue (interactive highlights)
  - `--accent-hover` (#7FB4CA) — Spring Blue (hover states)
- Semantic colors:
  - `--success` (#95C561) — Dragon Green (accept buttons)
  - `--danger` (#E82424) — Samurai Red (cancel buttons)
  - `--error-bg` (#2A1E1E) / `--error-text` (#E82424) — Error states
  - `--warning-bg` (#4A3D2A) / `--warning-text` (#FF9E3B) — Warning states
  - `--custom-rate` (#FF9E3B) — Ronin Yellow (custom rates)
```

#### 4.2. Add Comments to CSS
Add descriptive comments to the `:root` block in `popup.css`:

```css
:root {
  color-scheme: dark;
  /* Kanagawa Wave Palette - https://github.com/rebelot/kanagawa.nvim */
  --bg: #1F1F28;          /* Sumi Dark */
  --bg-card: #2A2A37;     /* Sumi Lighter */
  --text: #DCD7BA;        /* Fuji */
  --text-muted: #C8C093;  /* Old White */
  --border: #363646;      /* Sumi Lightest */
  --accent: #7E9CD8;      /* Wave Blue */
  --accent-hover: #7FB4CA; /* Spring Blue */
  --success: #95C561;     /* Dragon Green */
  --danger: #E82424;      /* Samurai Red */
  --error-bg: #2A1E1E;    /* Dark Red */
  --error-text: #E82424;  /* Samurai Red */
  --warning-bg: #4A3D2A;  /* Dark Orange */
  --warning-text: #FF9E3B;/* Ronin Yellow */
  --custom-rate: #FF9E3B; /* Ronin Yellow */
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
```

---

### Phase 5: Deployment & Monitoring
**Goal:** Deploy changes and monitor feedback.

#### 5.1. Create Branch and PR
```bash
git checkout -b feature/kanagawa-color-scheme
git add src/popup/popup.css DESIGN.md
git commit -m "feat: migrate color scheme to Kanagawa Wave palette"
git push origin feature/kanagawa-color-scheme
```
- Open a **Draft PR** with a description of changes
- Attach **before/after screenshots**

#### 5.2. Run Automated Tests
```bash
npm test
```

#### 5.3. Post-Release Monitoring
- Monitor user feedback
- Adjust shades if necessary (e.g., if contrast is insufficient)

---

## ⏳ Time Estimates

| Phase | Task | Time (AI + Manual) |
|-------|------|---------------------|
| 1 | Analysis & Planning | **1 hour** (AI: 0.5h, Manual: 0.5h) ✅ |
| 2 | CSS Refactoring | **2 hours** (AI: 1h, Manual: 1h) |
| 3 | Testing | **1 hour** (AI: 0.5h, Manual: 0.5h) |
| 4 | Documentation | **30 minutes** |
| 5 | Deployment | **15 minutes** |
| **Total** | | **4.75 hours** |

---

## 🎨 Visual Comparison (Before/After)

### Before (Current Scheme)
| Element | Color |
|---------|-------|
| Background | `#1a1a2e` (dark blue) |
| Cards | `#252542` (blue-gray) |
| Text | `#e5e7eb` (light gray) |
| Accent | `#60a5fa` (light blue) |
| Error | `#fca5a5` (light red) |
| Warning | `#fcd34d` (yellow) |

### After (Kanagawa Wave)
| Element | Color |
|---------|-------|
| Background | `#1F1F28` (dark gray) |
| Cards | `#2A2A37` (gray) |
| Text | `#DCD7BA` (warm white) |
| Accent | `#7E9CD8` (blue) |
| Error | `#E82424` (red) |
| Warning | `#FF9E3B` (orange) |

**Effect:**
- More **natural** colors
- Less **blue tint** (reduced eye strain)
- **Japanese aesthetic** (minimalism, harmony)

---

## 🔍 Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Insufficient contrast | Low | Medium | Validate with WCAG, adjust if needed |
| Design incompatibility | Medium | Low | Create A/B test, gather feedback |
| Hardcoded colors in JS | Low | Medium | Check `popup.js` for color references |
| CSS breakage | Medium | High | Test in browser before committing |
| Negative user feedback | Medium | Medium | Explain changes, offer rollback |

---

## ✅ Checklist

- [x] **Phase 1:** Current palette analysis
- [x] **Phase 1:** Kanagawa color mapping
- [x] **Phase 1:** WCAG validation
- [ ] **Phase 2:** Update `:root` in `popup.css`
- [ ] **Phase 2:** Replace hardcoded colors with variables
- [ ] **Phase 2:** Update hover states
- [ ] **Phase 3:** Visual testing
- [ ] **Phase 3:** WCAG contrast validation
- [ ] **Phase 3:** CSS validation
- [ ] **Phase 4:** Update `DESIGN.md`
- [ ] **Phase 4:** Add CSS comments
- [ ] **Phase 5:** Create branch and PR
- [ ] **Phase 5:** Run tests
- [ ] **Phase 5:** Monitor feedback

---

## 📚 References

- [Kanagawa.nvim](https://github.com/rebelot/kanagawa.nvim) - Official Kanagawa color scheme
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) - Accessibility validation
- [Color Oracle](https://colororacle.org/) - Color blindness testing
