/**
 * Theme Toggle System
 * Manages dual-theme switching between Riddler (green) and Batman (red) modes
 * Persists preference in localStorage
 */

(function() {
  'use strict';

  const THEME_RIDDLER = 'riddler';
  const THEME_BATMAN = 'batman';

  // Logo image paths
  const LOGO_RIDDLER = '/themes/hacker/static/img/riddle-logo.png';
  const LOGO_BATMAN = '/themes/hacker/static/img/batman-logo.png';

  // Button labels and tooltips
  const LABEL_RIDDLER = 'Riddler';
  const LABEL_BATMAN = 'Batman';
  const TITLE_RIDDLER = 'Switch to Batman';
  const TITLE_BATMAN = 'Switch to Riddler';

  /**
   * Get current theme from localStorage or default to Riddler
   */
  function getStoredTheme() {
    try {
      const stored = localStorage.getItem('ctf-theme');
      return stored === THEME_BATMAN ? THEME_BATMAN : THEME_RIDDLER;
    } catch (e) {
      console.warn('localStorage not available, using default theme');
      return THEME_RIDDLER;
    }
  }

  /**
   * Save theme preference to localStorage
   */
  function storeTheme(theme) {
    try {
      localStorage.setItem('ctf-theme', theme);
    } catch (e) {
      console.warn('Could not save theme to localStorage');
    }
  }

  /**
   * Update navbar logo based on current theme
   */
  function updateNavbarLogo(theme) {
    const logo = document.querySelector('.navbar-brand img');
    if (logo) {
      logo.src = theme === THEME_RIDDLER ? LOGO_RIDDLER : LOGO_BATMAN;
      logo.alt = theme === THEME_RIDDLER ? 'Riddler' : 'Batman';
    }
  }

  /**
   * Update hero logo watermark based on current theme
   */
  function updateHeroLogo(theme) {
    const heroLogo = document.getElementById('hero-logo');
    if (heroLogo) {
      heroLogo.src = theme === THEME_RIDDLER ? LOGO_RIDDLER : LOGO_BATMAN;
      heroLogo.alt = theme === THEME_RIDDLER ? 'Riddler' : 'Batman';
    }
  }

  /**
   * Update theme toggle button content and tooltip
   */
  function updateToggleButton(theme) {
    const btn = document.querySelector('.theme-switch');
    if (btn) {
      const nextTitle = theme === THEME_RIDDLER ? TITLE_RIDDLER : TITLE_BATMAN;
      const label = btn.querySelector('.theme-switch__value');
      const thumbLogo = btn.querySelector('.theme-switch__thumb-logo');

      btn.dataset.theme = theme;
      btn.title = nextTitle;
      btn.setAttribute('aria-label', nextTitle);

      if (label) {
        label.textContent = theme === THEME_RIDDLER ? LABEL_RIDDLER : LABEL_BATMAN;
      }

      if (thumbLogo) {
        thumbLogo.src = theme === THEME_RIDDLER ? LOGO_RIDDLER : LOGO_BATMAN;
      }
    }
  }

  /**
   * Update all CSS custom properties (handled automatically by [data-theme] attribute)
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /**
   * Notify other scripts (matrix rain) that theme has changed
   */
  function dispatchThemeChange(theme) {
    const event = new CustomEvent('themechange', {
      detail: {
        theme: theme,
        accentRgb: getAccentRgb(theme)
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * Get accent color RGB values for canvas
   */
  function getAccentRgb(theme) {
    if (theme === THEME_BATMAN) {
      return '230, 0, 0';  // Batman red
    }
    return '0, 255, 65';   // Riddler green
  }

  /**
   * Set global ACCENT_RGB variable for matrix rain script
   */
  function setGlobalAccent(theme) {
    window.ACCENT_RGB = getAccentRgb(theme);
  }

  /**
   * Theme toggle click handler
   */
  function handleToggleClick() {
    const currentTheme = getStoredTheme();
    const newTheme = currentTheme === THEME_RIDDLER ? THEME_BATMAN : THEME_RIDDLER;

    applyTheme(newTheme);
    storeTheme(newTheme);
    updateNavbarLogo(newTheme);
    updateHeroLogo(newTheme);
    updateToggleButton(newTheme);
    setGlobalAccent(newTheme);
    dispatchThemeChange(newTheme);

    console.log(`Theme switched to: ${newTheme}`);
  }

  /**
   * Initialize theme on page load
   */
  function init() {
    const theme = getStoredTheme();

    applyTheme(theme);
    updateNavbarLogo(theme);
    updateHeroLogo(theme);
    updateToggleButton(theme);
    setGlobalAccent(theme);

    // Attach click handler to theme toggle button
    const toggleBtn = document.querySelector('.theme-switch');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', handleToggleClick);
    }

    console.log(`Theme initialized: ${theme}`);
  }

  // Run initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for manual control if needed
  window.ThemeManager = {
    setTheme: (theme) => {
      if (theme === THEME_RIDDLER || theme === THEME_BATMAN) {
        applyTheme(theme);
        storeTheme(theme);
        updateNavbarLogo(theme);
        updateHeroLogo(theme);
        updateToggleButton(theme);
        setGlobalAccent(theme);
        dispatchThemeChange(theme);
      }
    },
    getTheme: getStoredTheme,
    toggle: handleToggleClick
  };
})();
