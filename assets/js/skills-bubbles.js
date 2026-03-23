/**
 * skills-bubbles.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Animated physics bubble visualisation for a skills list.
 *
 * USAGE
 * -----
 * 1. Add this to your HTML (after the canvas/wrapper markup exists in the DOM):
 *
 *      <script src="skills-bubbles.js"></script>
 *      <script>
 *        SkillsBubbles.init(skillsData);
 *      </script>
 *
 * 2. Pass in an array of skill objects:
 *
 *      const skillsData = [
 *        { name: "JavaScript", level: "expert",       category: "frontend" },
 *        { name: "CSS",        level: "advanced",     category: "frontend" },
 *        { name: "Python",     level: "intermediate", category: "backend"  },
 *        ...
 *      ];
 *
 * EXPECTED HTML STRUCTURE
 * -----------------------
 *   <div class="skills-canvas-wrapper">
 *     <canvas id="skills-canvas"></canvas>
 *     <div class="skills-legend"></div>   ← populated automatically
 *   </div>
 *
 * CONFIG (optional second argument to init)
 * -----------------------------------------
 *   SkillsBubbles.init(skillsData, {
 *     canvasId:   "skills-canvas",   // id of the <canvas> element
 *     wrapperId:  "skills-canvas-wrapper", // class of the wrapper div
 *     legendClass: "skills-legend",  // class of the legend container
 *     palette: [ ... ],              // override colour palette (see below)
 *     levelRadius: { ... },          // override radius-per-level map
 *     repelRadius: 120,              // px radius of mouse repulsion field
 *     repelForce:  1.2,              // strength of mouse repulsion
 *     maxSpeed:    2.5,              // max bubble velocity (px/frame)
 *     driftNoise:  0.02,             // random drift added each frame
 *   });
 */

const SkillsBubbles = (() => {

  // ── Default configuration ────────────────────────────────────────────────
  const DEFAULTS = {
    canvasId:    "skills-canvas",
    wrapperId:   "skills-canvas-wrapper",
    legendClass: "skills-legend",

    // Each entry: { fill, stroke, text }
    // Assigned to categories in the order they are first encountered.
    palette: [
      { fill: "#e8f4fd", stroke: "#3b82f6", text: "#1d4ed8" }, // blue
      { fill: "#fdf4e8", stroke: "#f59e0b", text: "#92400e" }, // amber
      { fill: "#edfdf4", stroke: "#10b981", text: "#065f46" }, // emerald
      { fill: "#fdf2f8", stroke: "#ec4899", text: "#9d174d" }, // pink
      { fill: "#f5f3ff", stroke: "#8b5cf6", text: "#4c1d95" }, // violet
      { fill: "#fff1f2", stroke: "#f43f5e", text: "#881337" }, // rose
    ],

    // Bubble radius (px) keyed on the lowercased `level` value.
    // Any unrecognised level falls back to `default`.
    levelRadius: {
      beginner:     28,
      intermediate: 38,
      advanced:     50,
      expert:       60,
      default:      36,
    },

    repelRadius: 120,   // mouse repulsion starts this many px away
    repelForce:  1.2,   // multiplier for repulsion strength
    maxSpeed:    2.5,   // terminal velocity in px/frame
    driftNoise:  0.02,  // small random nudge applied every frame
  };

  // ── Module-level state ────────────────────────────────────────────────────
  let cfg     = {};          // merged config (DEFAULTS + user overrides)
  let canvas  = null;        // <canvas> DOM element
  let ctx     = null;        // 2-D rendering context
  let wrapper = null;        // wrapper <div>
  let bubbles = [];          // array of live bubble objects
  let mouse   = { x: -9999, y: -9999 }; // current mouse position in canvas-space
  let animId  = null;        // requestAnimationFrame handle (for cancellation)
  let catColour = {};        // { categoryName → palette entry }


  // ══════════════════════════════════════════════════════════════════════════
  // 1.  INITIALISATION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Public entry point.
   * @param {Array}  skillsData  - array of { name, level, category } objects
   * @param {Object} userCfg     - optional config overrides
   */
  function init(skillsData, userCfg = {}) {
    // Merge user config on top of defaults
    cfg = Object.assign({}, DEFAULTS, userCfg);
    if (userCfg.levelRadius) {
      cfg.levelRadius = Object.assign({}, DEFAULTS.levelRadius, userCfg.levelRadius);
    }

    // Resolve DOM elements
    canvas  = document.getElementById(cfg.canvasId);
    wrapper = document.querySelector(`.${cfg.wrapperId}`);
    if (!canvas || !wrapper) {
      console.error("SkillsBubbles: could not find canvas or wrapper element.");
      return;
    }
    ctx = canvas.getContext("2d");

    // Stop any existing animation loop before re-initialising
    if (animId) cancelAnimationFrame(animId);

    assignCategoryColours(skillsData);
    buildLegend(skillsData);
    resizeCanvas();
    initBubbles(skillsData);

    attachEventListeners(skillsData);
    tick();
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 2.  CATEGORY → COLOUR MAPPING
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Walk through every skill and, the first time a category is seen,
   * assign the next colour from cfg.palette (wrapping around if needed).
   *
   * Result stored in module-level `catColour` object:
   *   catColour["frontend"] = { fill: "...", stroke: "...", text: "..." }
   */
  function assignCategoryColours(skillsData) {
    catColour = {};
    let colourIndex = 0;
    skillsData.forEach(skill => {
      if (!catColour[skill.category]) {
        catColour[skill.category] = cfg.palette[colourIndex % cfg.palette.length];
        colourIndex++;
      }
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 3.  LEGEND BUILDER
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Populates the .skills-legend element with one coloured dot + label
   * per unique category. The dot colour matches the bubble stroke colour
   * for that category.
   */
  function buildLegend(skillsData) {
    const legendEl = document.querySelector(`.${cfg.legendClass}`);
    if (!legendEl) return;

    legendEl.innerHTML = "";
    const seen = new Set();

    skillsData.forEach(skill => {
      if (seen.has(skill.category)) return;
      seen.add(skill.category);

      const col  = catColour[skill.category];
      const span = document.createElement("span");
      span.className = "legend-dot";

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = col.stroke;

      span.appendChild(dot);
      span.appendChild(document.createTextNode(
        skill.category.charAt(0).toUpperCase() + skill.category.slice(1)
      ));
      legendEl.appendChild(span);
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 4.  CANVAS SIZING
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Sets canvas pixel dimensions to match its CSS display size.
   *
   * Why this matters: a <canvas> has two separate size concepts —
   *   • The CSS/layout size  (what the browser displays)
   *   • The pixel buffer size (canvas.width / canvas.height)
   * If they don't match, everything looks blurry or stretched.
   * We set the buffer to match the wrapper's clientWidth each time.
   *
   * Height is 55 % of width, clamped to a minimum of 420 px so short
   * skill lists still have room to breathe.
   */
  function resizeCanvas() {
    canvas.width  = wrapper.clientWidth;
    canvas.height = Math.max(420, wrapper.clientWidth * 0.55);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 5.  BUBBLE CREATION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Converts each skill object into a "bubble" — a plain JS object that
   * holds all the state the physics and rendering systems need:
   *
   *   name, level   – display strings
   *   r             – rest radius (px), derived from skill level
   *   col           – colour object { fill, stroke, text }
   *   x, y          – current centre position
   *   vx, vy        – velocity (px/frame)
   *   currentR      – animated radius (eases toward targetR)
   *   targetR       – what currentR should ease toward
   *   hovered       – true when the mouse is within (r + 20) px
   *
   * After creation we run separateBubbles() to resolve any initial overlaps.
   */
  function initBubbles(skillsData) {
    bubbles = skillsData.map(skill => {
      const r = cfg.levelRadius[skill.level?.toLowerCase()] ?? cfg.levelRadius.default;
      return {
        name:     skill.name,
        level:    skill.level,
        r,
        col:      catColour[skill.category],
        x:        randomBetween(r, canvas.width  - r),
        y:        randomBetween(r, canvas.height - r),
        vx:       randomBetween(-0.5, 0.5),
        vy:       randomBetween(-0.5, 0.5),
        targetR:  r,
        currentR: r,
        hovered:  false,
      };
    });

    separateBubbles();
  }

  /**
   * Runs a fixed number of constraint-relaxation iterations to push apart
   * any bubbles that were placed on top of each other at random spawn time.
   *
   * Each iteration checks every unique pair (i, j).  If the distance between
   * their centres is less than the sum of their radii + a small gap, both
   * bubbles are nudged apart equally along the line connecting them.
   *
   * 80 iterations is overkill for most lists but still runs in < 1 ms.
   */
  function separateBubbles() {
    for (let iter = 0; iter < 80; iter++) {
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const a = bubbles[i], b = bubbles[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const minDist = a.r + b.r + 6;
          if (dist < minDist) {
            const push = (minDist - dist) / 2;
            const nx = dx / dist, ny = dy / dist;
            a.x -= nx * push;  a.y -= ny * push;
            b.x += nx * push;  b.y += ny * push;
          }
        }
      }
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 6.  DRAWING  (runs every frame)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Draws a single bubble at its current position.
   *
   * Layers (painter's algorithm — back to front):
   *   1. Drop shadow  (ctx.shadow* properties)
   *   2. Filled circle  (background colour)
   *   3. Stroke ring    (border colour)
   *   4. Radial gradient shine  (gives the "glass bubble" look)
   *   5. Text label  (skill name, word-wrapped if needed)
   *   6. Level badge  (only visible on hover)
   */
  function drawBubble(b) {
    const r   = b.currentR;
    const col = b.col;

    // ── Layer 1: shadow ──────────────────────────────────────────────
    ctx.save();
    ctx.shadowColor = col.stroke + "55";   // stroke colour at ~33 % opacity
    ctx.shadowBlur  = b.hovered ? 18 : 8;

    // ── Layer 2: fill ────────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fillStyle = col.fill;
    ctx.fill();

    // ── Layer 3: stroke ──────────────────────────────────────────────
    ctx.lineWidth   = b.hovered ? 2.5 : 1.5;
    ctx.strokeStyle = col.stroke;
    ctx.stroke();
    ctx.restore();  // ← restores shadowBlur = 0 so shine isn't blurry

    // ── Layer 4: shine ───────────────────────────────────────────────
    // A radial gradient whose bright centre is offset toward the top-left,
    // simulating a light source above and to the left of the bubble.
    const grad = ctx.createRadialGradient(
      b.x - r * 0.3, b.y - r * 0.3, r * 0.05,   // inner circle (offset)
      b.x,           b.y,           r             // outer circle (centred)
    );
    grad.addColorStop(0, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // ── Layer 5: text label ───────────────────────────────────────────
    // Font size scales proportionally with bubble radius so labels always fit.
    const fontSize = Math.max(9, r * 0.32);
    ctx.font         = `bold ${fontSize}px 'Segoe UI', sans-serif`;
    ctx.fillStyle    = col.text;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";

    // Word-wrap: build an array of lines that each fit within the bubble.
    const maxLineWidth = r * 1.6;
    const words  = b.name.split(" ");
    const lines  = [];
    let current  = "";
    words.forEach(word => {
      const test = current ? current + " " + word : word;
      if (ctx.measureText(test).width > maxLineWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    lines.push(current);

    // Vertically centre the block of lines inside the bubble.
    const lineHeight = r * 0.34;
    const startY     = b.y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => ctx.fillText(line, b.x, startY + i * lineHeight));

    // ── Layer 6: level badge (hover only) ────────────────────────────
    if (b.hovered && b.level) {
      ctx.font      = `${Math.max(7, r * 0.24)}px 'Segoe UI', sans-serif`;
      ctx.fillStyle = col.stroke;
      ctx.fillText(b.level, b.x, b.y + r * 0.55);
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 7.  PHYSICS  (runs every frame)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * updatePhysics() is called once per frame, before drawing.
   * It steps every bubble forward one tick using simple Euler integration:
   *
   *   position += velocity
   *
   * and handles four forces / constraints:
   *
   *   A. Mouse repulsion
   *   B. Random drift noise
   *   C. Velocity damping (simulated air resistance)
   *   D. Speed clamping
   *   E. Wall collision (axis-aligned bounding box)
   *   F. Bubble–bubble soft collision
   *   G. Radius animation (smooth hover pulse)
   */
  function updatePhysics() {

    // ── Per-bubble updates ────────────────────────────────────────────
    bubbles.forEach(b => {

      // A. Mouse repulsion
      // Compute vector from mouse to bubble centre.
      // If the mouse is within cfg.repelRadius px, push the bubble away.
      // Force is stronger the closer the mouse is (linear falloff).
      const dx  = b.x - mouse.x;
      const dy  = b.y - mouse.y;
      const d2  = dx * dx + dy * dy;   // squared distance (cheaper than sqrt)
      b.hovered = d2 < (b.r + 20) * (b.r + 20);

      const repelR2 = cfg.repelRadius * cfg.repelRadius;
      if (d2 < repelR2 && d2 > 0.01) {
        const d     = Math.sqrt(d2);
        const force = (1 - d / cfg.repelRadius) * cfg.repelForce;
        b.vx += (dx / d) * force;
        b.vy += (dy / d) * force;
      }

      // B. Drift noise — tiny random nudge so bubbles never fully settle
      b.vx += randomBetween(-cfg.driftNoise, cfg.driftNoise);
      b.vy += randomBetween(-cfg.driftNoise, cfg.driftNoise);

      // C. Damping — multiply velocity by < 1 each frame.
      // 0.98 means the bubble loses 2 % of its speed per frame (~30 % per second).
      b.vx *= 0.98;
      b.vy *= 0.98;

      // D. Speed clamping — hard cap to prevent runaway velocities.
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (speed > cfg.maxSpeed) {
        b.vx = (b.vx / speed) * cfg.maxSpeed;
        b.vy = (b.vy / speed) * cfg.maxSpeed;
      }

      // Integrate position
      b.x += b.vx;
      b.y += b.vy;

      // E. Wall collision (bounce).
      // If a bubble's centre passes beyond the canvas edge by more than its
      // radius, snap it back and reverse the perpendicular velocity component.
      const cr = b.currentR;
      if (b.x < cr)                 { b.x = cr;                 b.vx =  Math.abs(b.vx); }
      if (b.x > canvas.width  - cr) { b.x = canvas.width  - cr; b.vx = -Math.abs(b.vx); }
      if (b.y < cr)                 { b.y = cr;                 b.vy =  Math.abs(b.vy); }
      if (b.y > canvas.height - cr) { b.y = canvas.height - cr; b.vy = -Math.abs(b.vy); }

      // G. Radius animation — ease currentR toward targetR (exponential smoothing).
      b.targetR  = b.hovered ? b.r * 1.12 : b.r;
      b.currentR += (b.targetR - b.currentR) * 0.12;
    });

    // ── F. Bubble–bubble soft collision ────────────────────────────────
    // Check every unique pair.  If they overlap, nudge them apart and
    // exchange the normal component of their velocities (elastic collision).
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i], b = bubbles[j];
        const dx   = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const minD = a.currentR + b.currentR + 4;

        if (dist < minD) {
          // Unit normal vector pointing from a → b
          const nx = dx / dist, ny = dy / dist;

          // Push both bubbles apart by half the overlap distance each
          const overlap = (minD - dist) * 0.5;
          a.x -= nx * overlap;  a.y -= ny * overlap;
          b.x += nx * overlap;  b.y += ny * overlap;

          // Relative velocity along the normal axis
          const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
          const dot = dvx * nx + dvy * ny;

          // Only exchange momentum if bubbles are moving toward each other
          if (dot < 0) {
            a.vx += dot * nx;  a.vy += dot * ny;
            b.vx -= dot * nx;  b.vy -= dot * ny;
          }
        }
      }
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 8.  MAIN ANIMATION LOOP
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Called via requestAnimationFrame (rAF) at ~60 fps.
   *
   * Each frame:
   *   1. Clear the entire canvas
   *   2. Run physics (move bubbles, resolve collisions)
   *   3. Draw every bubble
   *   4. Schedule the next frame
   *
   * rAF automatically pauses when the tab is hidden (saves CPU/battery).
   */
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updatePhysics();
    bubbles.forEach(drawBubble);
    animId = requestAnimationFrame(tick);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 9.  EVENT LISTENERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Attaches all DOM event listeners needed by the animation.
   * Called once during init(); safe to call again (old listeners are on the
   * old canvas reference which is replaced on resize/reinit).
   */
  function attachEventListeners(skillsData) {

    // Track mouse position in canvas-local coordinates.
    // getBoundingClientRect() accounts for any CSS scaling or page offset.
    canvas.addEventListener("mousemove", e => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });

    // Move the virtual mouse off-screen when it leaves the canvas
    // so no repulsion happens after the cursor exits.
    canvas.addEventListener("mouseleave", () => {
      mouse.x = -9999;
      mouse.y = -9999;
    });

    // Touch: treat the first touch point the same as a mouse.
    // passive: false allows calling preventDefault() to stop scroll-jank.
    canvas.addEventListener("touchmove", e => {
      e.preventDefault();
      const rect  = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      mouse.x = touch.clientX - rect.left;
      mouse.y = touch.clientY - rect.top;
    }, { passive: false });

    canvas.addEventListener("touchend", () => {
      mouse.x = -9999;
      mouse.y = -9999;
    });

    // Responsive resize: recalculate canvas size and respawn bubbles.
    // Debounced by 150 ms to avoid thrashing during a live resize drag.
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeCanvas();
        initBubbles(skillsData);
      }, 150);
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 10. UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  /** Returns a random float in [min, max). */
  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }


  // ── Public API ────────────────────────────────────────────────────────────
  return { init };

})();
