/**
 * skills-bubbles.js
 *
 * USAGE
 *   <script src="skills-bubbles.js"></script>
 *   <script>
 *     SkillsBubbles.init([
 *       { name: "Python",     category: "language", projects: ["Project A"] },
 *       { name: "JavaScript", category: "frontend", projects: ["Project B"] },
 *     ]);
 *   </script>
 *
 * REQUIRED HTML
 *   <div class="skills-canvas-wrapper">
 *     <div class="skills-project-panel"></div>
 *     <div class="skills-canvas-area">
 *       <canvas id="skills-canvas"></canvas>
 *       <div class="skills-legend"></div>
 *     </div>
 *   </div>
 */

const SkillsBubbles = (() => {

  // ── Constants ─────────────────────────────────────────────────────────────
  const BUBBLE_RADIUS  = 40;   // all bubbles the same size
  const REPEL_RADIUS   = 110;
  const REPEL_FORCE    = 1.1;
  const MAX_SPEED      = 2.2;
  const DRIFT_NOISE    = 0.02;
  const BUBBLE_COLOUR  = { fill: "#e8f4fd", stroke: "#3b82f6", text: "#1d4ed8" };
  const SELECTED_COLOUR = { fill: "#3b82f6", stroke: "#1d4ed8", text: "#ffffff" };

  // ── State ─────────────────────────────────────────────────────────────────
  let canvas   = null;
  let ctx      = null;
  let panel    = null;
  let bubbles  = [];
  let selected = null;
  let mouse    = { x: -9999, y: -9999 };
  let animId   = null;


  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC: init
  // ══════════════════════════════════════════════════════════════════════════

  function init(skillsData) {
    canvas = document.getElementById("skills-canvas");
    panel  = document.querySelector(".skills-project-panel");

    if (!canvas) { console.error("SkillsBubbles: #skills-canvas not found"); return; }
    if (!panel)  { console.error("SkillsBubbles: .skills-project-panel not found"); return; }

    ctx = canvas.getContext("2d");

    if (animId) cancelAnimationFrame(animId);

    buildLegend(skillsData);
    resizeCanvas();
    spawnBubbles(skillsData);
    bindEvents(skillsData);
    showPanel(null);
    tick();
  }


  // ══════════════════════════════════════════════════════════════════════════
  // LEGEND
  // ══════════════════════════════════════════════════════════════════════════

  function buildLegend(skillsData) {
    const el = document.querySelector(".skills-legend");
    if (!el) return;
    el.innerHTML = "";

    const categories = [...new Set(skillsData.map(s => s.category))];
    categories.forEach(cat => {
      const span = document.createElement("span");
      span.className = "legend-item";
      span.innerHTML =
        `<span class="legend-dot"></span>${cat.charAt(0).toUpperCase() + cat.slice(1)}`;
      el.appendChild(span);
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // CANVAS SIZING
  // ══════════════════════════════════════════════════════════════════════════

  function resizeCanvas() {
    const area    = canvas.parentElement;
    canvas.width  = area.clientWidth;
    canvas.height = Math.max(420, area.clientWidth * 0.65);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // BUBBLE CREATION
  // ══════════════════════════════════════════════════════════════════════════

  function spawnBubbles(skillsData) {
    const R = BUBBLE_RADIUS;
    bubbles = skillsData.map(skill => ({
      name:     skill.name,
      projects: Array.isArray(skill.projects) ? skill.projects : [],
      r:        R,
      currentR: R,
      x:        randomBetween(R, canvas.width  - R),
      y:        randomBetween(R, canvas.height - R),
      vx:       randomBetween(-0.6, 0.6),
      vy:       randomBetween(-0.6, 0.6),
      selected: false,
      hovered:  false,
    }));

    // Push apart any overlapping pairs at spawn time
    for (let pass = 0; pass < 80; pass++) {
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const a = bubbles[i], b = bubbles[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d  = Math.sqrt(dx*dx + dy*dy) || 0.01;
          const min = a.r + b.r + 6;
          if (d < min) {
            const push = (min - d) / 2;
            const nx = dx/d, ny = dy/d;
            a.x -= nx*push; a.y -= ny*push;
            b.x += nx*push; b.y += ny*push;
          }
        }
      }
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // DRAW
  // ══════════════════════════════════════════════════════════════════════════

  function drawBubble(b) {
    const r   = b.currentR;
    const col = b.selected ? SELECTED_COLOUR : BUBBLE_COLOUR;

    // Shadow
    ctx.save();
    ctx.shadowColor = col.stroke + (b.selected ? "cc" : "55");
    ctx.shadowBlur  = b.selected ? 22 : b.hovered ? 14 : 6;

    // Circle fill + stroke
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fillStyle = col.fill;
    ctx.fill();
    ctx.lineWidth   = b.selected ? 2.5 : 1.5;
    ctx.strokeStyle = col.stroke;
    ctx.stroke();
    ctx.restore();

    // Shine
    const shine = ctx.createRadialGradient(
      b.x - r*0.3, b.y - r*0.3, r*0.05,
      b.x,         b.y,         r
    );
    shine.addColorStop(0, "rgba(255,255,255,0.5)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fillStyle = shine;
    ctx.fill();

    // Label (word-wrapped)
    ctx.font         = `bold ${Math.max(9, r * 0.32)}px 'Segoe UI', sans-serif`;
    ctx.fillStyle    = col.text;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";

    const maxW  = r * 1.6;
    const words = b.name.split(" ");
    const lines = [];
    let line = "";
    words.forEach(w => {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line); line = w;
      } else {
        line = test;
      }
    });
    lines.push(line);

    const lh     = r * 0.36;
    const startY = b.y - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, b.x, startY + i * lh));
  }


  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT PANEL
  // ══════════════════════════════════════════════════════════════════════════

  function showPanel(bubble) {
    if (!bubble) {
      panel.innerHTML = `<p class="spp-placeholder">Click a bubble to see related projects</p>`;
      return;
    }

    const projectRows = bubble.projects.length
      ? bubble.projects.map(p => `<li class="spp-item">${p}</li>`).join("")
      : `<li class="spp-item spp-empty">No projects listed</li>`;

    panel.innerHTML = `
      <h3 class="spp-title">${bubble.name}</h3>
      <ul class="spp-list">${projectRows}</ul>
    `;
  }


  // ══════════════════════════════════════════════════════════════════════════
  // PHYSICS
  // ══════════════════════════════════════════════════════════════════════════

  function physics() {
    bubbles.forEach(b => {
/*       // Mouse repulsion
      const dx = b.x - mouse.x, dy = b.y - mouse.y;
      const d2 = dx*dx + dy*dy;
      b.hovered = d2 < (b.r + 20) * (b.r + 20);

      if (d2 < REPEL_RADIUS * REPEL_RADIUS && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const f = (1 - d / REPEL_RADIUS) * REPEL_FORCE;
        b.vx += (dx/d) * f;
        b.vy += (dy/d) * f;
      } */

      // Drift + damping
      b.vx += randomBetween(-DRIFT_NOISE, DRIFT_NOISE);
      b.vy += randomBetween(-DRIFT_NOISE, DRIFT_NOISE);
      b.vx *= 0.98;
      b.vy *= 0.98;

      // Speed cap
      const spd = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
      if (spd > MAX_SPEED) { b.vx = b.vx/spd * MAX_SPEED; b.vy = b.vy/spd * MAX_SPEED; }

      b.x += b.vx;
      b.y += b.vy;

      // Wall bounce
      const cr = b.currentR;
      if (b.x < cr)                 { b.x = cr;                 b.vx =  Math.abs(b.vx); }
      if (b.x > canvas.width  - cr) { b.x = canvas.width  - cr; b.vx = -Math.abs(b.vx); }
      if (b.y < cr)                 { b.y = cr;                 b.vy =  Math.abs(b.vy); }
      if (b.y > canvas.height - cr) { b.y = canvas.height - cr; b.vy = -Math.abs(b.vy); }

      // Hover/selected radius pulse
      const target = b.selected ? b.r * 1.15 : b.hovered ? b.r * 1.08 : b.r;
      b.currentR  += (target - b.currentR) * 0.12;
    });

    // Bubble-bubble collision
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i], b = bubbles[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d  = Math.sqrt(dx*dx + dy*dy) || 0.01;
        const min = a.currentR + b.currentR + 4;
        if (d < min) {
          const nx = dx/d, ny = dy/d;
          const ov = (min - d) * 0.5;
          a.x -= nx*ov; a.y -= ny*ov;
          b.x += nx*ov; b.y += ny*ov;
          const dv = (b.vx - a.vx)*nx + (b.vy - a.vy)*ny;
          if (dv < 0) {
            a.vx += dv*nx; a.vy += dv*ny;
            b.vx -= dv*nx; b.vy -= dv*ny;
          }
        }
      }
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // LOOP
  // ══════════════════════════════════════════════════════════════════════════

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    physics();
    bubbles.forEach(drawBubble);
    animId = requestAnimationFrame(tick);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  function bindEvents(skillsData) {
    canvas.addEventListener("mousemove", e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });

    canvas.addEventListener("mouseleave", () => {
      mouse.x = -9999; mouse.y = -9999;
    });

    canvas.addEventListener("click", e => {
      const r  = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;

      // Find which bubble was clicked (reverse order = topmost first)
      let hit = null;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b  = bubbles[i];
        const dx = cx - b.x, dy = cy - b.y;
        if (dx*dx + dy*dy <= b.currentR * b.currentR) { hit = b; break; }
      }

      // Toggle selection
      const wasSelected = hit && hit.selected;
      bubbles.forEach(b => { b.selected = false; });

      if (hit && !wasSelected) {
        hit.selected = true;
        selected = hit;
      } else {
        selected = null;
      }

      showPanel(selected);
    });

    canvas.addEventListener("touchmove", e => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      mouse.x = e.touches[0].clientX - r.left;
      mouse.y = e.touches[0].clientY - r.top;
    }, { passive: false });

    canvas.addEventListener("touchend", () => {
      mouse.x = -9999; mouse.y = -9999;
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeCanvas();
        spawnBubbles(skillsData);
        selected = null;
        showPanel(null);
      }, 150);
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // UTIL
  // ══════════════════════════════════════════════════════════════════════════

  function randomBetween(min, max) { return min + Math.random() * (max - min); }

  return { init };

})();