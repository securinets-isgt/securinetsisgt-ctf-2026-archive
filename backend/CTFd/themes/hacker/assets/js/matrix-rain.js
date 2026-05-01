/**
 * Matrix Rain Effect
 * Creates falling character animation similar to The Matrix movie
 * Responds to theme changes to update accent color
 */

(function() {
  'use strict';

  const CHARACTERS = '?01ABCDEF#@!<>';
  const FONT_SIZE = 14;
  const COLUMN_SPACING = FONT_SIZE;
  const FALL_SPEED_MS = 55;  // ~18fps
  const OPACITY_BASE = 0.07;

  let canvas = null;
  let ctx = null;
  let columns = [];
  let animationId = null;
  let intervalId = null;
  let currentRgb = '0, 255, 65';  // Default Riddler green

  /**
   * Initialize canvas on the hero section
   */
  function initCanvas() {
    canvas = document.getElementById('matrix-rain-canvas');
    if (!canvas) {
      console.warn('Matrix rain canvas not found');
      return false;
    }

    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return true;
  }

  /**
   * Resize canvas to fill its container
   */
  function resizeCanvas() {
    if (!canvas) return;

    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;

    // Recalculate columns
    initColumns();
  }

  /**
   * Initialize column positions
   */
  function initColumns() {
    if (!canvas) return;

    const columnCount = Math.floor(canvas.width / COLUMN_SPACING);
    columns = [];

    for (let i = 0; i < columnCount; i++) {
      columns.push({
        x: i * COLUMN_SPACING,
        y: Math.random() * -canvas.height,  // Start above canvas
        speed: 1 + Math.random() * 2,
        chars: generateRandomChars(10 + Math.floor(Math.random() * 20))
      });
    }
  }

  /**
   * Generate random character string
   */
  function generateRandomChars(length) {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
    }
    return result;
  }

  /**
   * Draw a single column of falling characters
   */
  function drawColumn(column) {
    if (!ctx) return;

    const fontSize = FONT_SIZE;
    ctx.font = `${fontSize}px "Space Mono", monospace`;

    // Draw trailing characters with fading opacity
    for (let i = 0; i < column.chars.length; i++) {
      const y = column.y - (i * fontSize);

      // Skip if outside canvas
      if (y < -fontSize || y > canvas.height + fontSize) continue;

      // Fade based on position (head is brightest)
      let opacity = OPACITY_BASE;
      if (i === 0) {
        opacity = 0.5;  // Leading character brighter
      } else {
        opacity = OPACITY_BASE * (1 - (i / column.chars.length));
      }

      ctx.fillStyle = `rgba(${currentRgb}, ${opacity})`;
      ctx.fillText(column.chars[i], column.x, y);
    }
  }

  /**
   * Update column positions
   */
  function updateColumns() {
    for (let column of columns) {
      column.y += column.speed * FONT_SIZE / 4;

      // Reset column when it goes below canvas
      if (column.y > canvas.height + (column.chars.length * FONT_SIZE)) {
        column.y = -column.chars.length * FONT_SIZE;
        column.speed = 1 + Math.random() * 2;
        column.chars = generateRandomChars(10 + Math.floor(Math.random() * 20));
      }
    }
  }

  /**
   * Main animation loop
   */
  function animate() {
    if (!ctx) return;

    // Clear canvas with transparent black (for trail effect)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all columns
    for (let column of columns) {
      drawColumn(column);
    }

    updateColumns();
    animationId = requestAnimationFrame(animate);
  }

  /**
   * Start the animation
   */
  function start() {
    if (animationId) stop();

    if (!initCanvas()) return;

    animate();
    console.log('Matrix rain started');
  }

  /**
   * Stop the animation
   */
  function stop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  /**
   * Update accent color dynamically
   */
  function setAccentColor(rgb) {
    currentRgb = rgb;
  }

  // Listen for theme change events
  window.addEventListener('themechange', (e) => {
    if (e.detail && e.detail.accentRgb) {
      setAccentColor(e.detail.accentRgb);
      console.log('Matrix rain color updated:', e.detail.accentRgb);
    }
  });

  // Auto-start when page loads (if canvas exists)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    // Small delay to ensure canvas is in DOM
    setTimeout(start, 100);
  }

  // Expose for manual control
  window.MatrixRain = {
    start: start,
    stop: stop,
    setAccentColor: setAccentColor
  };
})();
