/**
 * skills-bubbles.js
 *
 * USAGE — pass the raw text of projects.yml
 *   <script src="skills-bubbles.js"></script>
 *   <script>
 *     fetch("/path/to/projects.yml")
 *       .then(r => r.text())
 *       .then(yaml => SkillsBubbles.init(yaml));
 *   </script>
 *
 *   Or inline:
 *   <script>
 *     SkillsBubbles.init(`
 *       projects:
 *         - name: My Project
 *           ...
 *     `);
 *   </script>
 *
 * REQUIRED HTML
 *   <div class="skills-canvas-wrapper">
 *     <div class="skills-project-panel"></div>
 *     <div class="skills-canvas-area">
 *       <canvas id="skills-canvas"></canvas>
 *     </div>
 *   </div>
 *
 * The wrapper needs a project bar injected above it. The script creates and
 * inserts a <div class="skills-project-bar"> immediately before
 * .skills-canvas-wrapper if one doesn't already exist.
 *
 * THEMING
 *   All colours are resolved from CSS custom properties at paint time so the
 *   component inherits your page's light/dark mode automatically.
 *   The properties used are:
 *     --color-background-primary   block fill / panel bg
 *     --color-background-secondary dimmed block fill / wrapper bg
 *     --color-text-primary         active block fill + tab active bg
 *     --color-text-secondary       default block text
 *     --color-text-tertiary        placeholder + dimmed text
 *     --color-border-tertiary      subtle borders
 *     --color-border-secondary     default block stroke
 *     --font-sans                  label typeface
 */

const SkillsBubbles = (() => {

  // ── Constants ─────────────────────────────────────────────────────────────
  const BLOCK_W    = 90;
  const BLOCK_H    = 36;
  const BLOCK_R    = 5;    // corner radius
  const GAP        = 7;
  const GRAVITY    = 0.22;
  const FLOAT_K    = 0.09; // spring stiffness toward float target
  const GROUND_K   = 0.14; // spring stiffness toward ground
  const DAMPING    = 0.75;
  const MAX_SPEED  = 4.0;
  const DRIFT      = 0.010;


  // ── State ─────────────────────────────────────────────────────────────────
  let canvas          = null;
  let ctx             = null;
  let panel           = null;
  let projectBar      = null;
  let blocks          = [];
  let selectedProject = null;
  let selectedSkill   = null;
  let animId          = null;


  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC: init(skillsData, projectsData)
  // ══════════════════════════════════════════════════════════════════════════

  function init(yamlText) {
    canvas = document.getElementById("skills-canvas");
    panel  = document.querySelector(".skills-project-panel");

    if (!canvas) { console.error("SkillsBubbles: #skills-canvas not found"); return; }
    if (!panel)  { console.error("SkillsBubbles: .skills-project-panel not found"); return; }

    ctx = canvas.getContext("2d");

    if (animId) cancelAnimationFrame(animId);

    const { projectsData, skillsData } = parseYaml(yamlText);

    buildProjectBar(projectsData);
    resizeCanvas();
    spawnBlocks(skillsData);
    bindEvents(skillsData, projectsData);
    showPanelDefault();
    tick();
  }


  // ══════════════════════════════════════════════════════════════════════════
  // PROJECT BAR
  // Injected as a sibling immediately before .skills-canvas-wrapper, or
  // appended to its parent — whichever is found first.
  // ══════════════════════════════════════════════════════════════════════════

  function buildProjectBar(projectsData) {
    // Remove stale bar if re-initialising
    const old = document.querySelector(".skills-project-bar");
    if (old) old.remove();

    projectBar = document.createElement("div");
    projectBar.className = "skills-project-bar";
    applyBarStyles(projectBar);

    projectsData.forEach(p => {
      const btn = document.createElement("button");
      btn.className       = "skills-project-tab";
      btn.textContent     = p.name;
      btn.dataset.project = p.name;
      applyTabStyles(btn, false);

      btn.addEventListener("click", () => {
        if (selectedProject === p.name) {
          clearSelection();
          showPanelDefault();
        } else {
          selectedProject = p.name;
          selectedSkill   = null;
          updateTabStates();
          updateBlockTargets();
          showPanelProject(p);
        }
      });

      projectBar.appendChild(btn);
    });

    // Insert before the canvas wrapper, falling back to parent
    const wrapper = canvas.closest(".skills-canvas-wrapper") || canvas.parentElement.parentElement;
    if (wrapper && wrapper.parentElement) {
      wrapper.parentElement.insertBefore(projectBar, wrapper);
    } else {
      document.body.prepend(projectBar);
    }
  }

  function updateTabStates() {
    projectBar.querySelectorAll(".skills-project-tab").forEach(btn => {
      const active = btn.dataset.project === selectedProject;
      applyTabStyles(btn, active);
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // INLINE STYLES  (keeps the script self-contained; override with CSS if needed)
  // ══════════════════════════════════════════════════════════════════════════

  function applyBarStyles(el) {
    Object.assign(el.style, {
      display:      "flex",
      flexWrap:     "wrap",
      gap:          "6px",
      padding:      "8px 0",
      background:   "transparent",
    });
  }

  function applyTabStyles(btn, active) {
    Object.assign(btn.style, {
      fontSize:     "13px",
      padding:      "4px 12px",
      borderRadius: "4px",
      border:       "1px solid currentColor",
      background:   active ? "currentColor" : "transparent",
      color:        "inherit",
      opacity:      active ? "1" : "0.5",
      cursor:       "pointer",
      fontFamily:   "inherit",
      lineHeight:   "1.4",
    });
    // for active: text needs to contrast against the filled bg
    // use a pseudo-trick: wrap label in a span with mix-blend-mode
    if (active) {
      btn.style.filter = "invert(0)";
      btn.style.outline = "2px solid currentColor";
      btn.style.outlineOffset = "1px";
      btn.style.background = "transparent";
      btn.style.fontWeight = "600";
      btn.style.opacity = "1";
    } else {
      btn.style.outline = "none";
      btn.style.fontWeight = "normal";
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // CANVAS SIZING
  // ══════════════════════════════════════════════════════════════════════════

  function resizeCanvas() {
    const area   = canvas.parentElement;
    canvas.width = area.clientWidth || 600;
    // Height is set to fill the wrapper; wrapper has explicit min-height in CSS.
    // Read it from the wrapper, not the canvas area which may be 0 before paint.
    const wrapper = canvas.closest(".skills-canvas-wrapper");
    const wrapH   = wrapper ? wrapper.clientHeight : 0;
    canvas.height = Math.max(380, wrapH || canvas.width * 0.55);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK CREATION
  // Blocks are arranged in a grid that fills from the bottom up.
  // groundY is their resting position; floatY is where they rise to.
  // ══════════════════════════════════════════════════════════════════════════

  function spawnBlocks(skillsData) {
    const cols   = Math.max(1, Math.floor((canvas.width + GAP) / (BLOCK_W + GAP)));
    const floorY = canvas.height - BLOCK_H / 2 - GAP;

    blocks = skillsData.map((skill, i) => {
      const col     = i % cols;
      const row     = Math.floor(i / cols);
      const groundY = floorY - row * (BLOCK_H + GAP);

      const groundX = GAP + col * (BLOCK_W + GAP) + BLOCK_W / 2;
      return {
        name:     skill.name,
        projects: Array.isArray(skill.projects) ? skill.projects : [],
        x:        groundX,
        y:        groundY,
        vx:       0,
        vy:       0,
        groundX,
        groundY,
        floatX:   groundX,
        floatY:   GAP + BLOCK_H / 2,
        lifted:   false,
      };
    });
  }

  function updateBlockTargets() {
    // Assign float positions as a packed grid — both x and floatY are
    // recalculated so lifted blocks never share a column or overlap.
    const cols      = Math.max(1, Math.floor((canvas.width + GAP) / (BLOCK_W + GAP)));
    const topMargin = GAP + BLOCK_H / 2;

    const lifted = blocks.filter(b => {
      if (selectedProject) return b.projects.includes(selectedProject);
      if (selectedSkill)   return b.name === selectedSkill;
      return false;
    });

    lifted.forEach((b, i) => {
      const col  = i % cols;
      const row  = Math.floor(i / cols);
      b.floatY   = topMargin + row * (BLOCK_H + GAP);
      b.floatX   = GAP + col * (BLOCK_W + GAP) + BLOCK_W / 2;
      b.lifted   = true;
    });

    blocks.forEach(b => {
      if (!lifted.includes(b)) {
        b.lifted = false;
        b.floatX = b.x; // snap float target back to ground x
      }
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // DRAW
  // ══════════════════════════════════════════════════════════════════════════

  function getCSSVar(name, fallback) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim() || fallback;
  }

  function drawBlock(b) {
    const hasSelection = selectedProject !== null || selectedSkill !== null;
    const isActive     = b.lifted;
    const isDimmed     = hasSelection && !isActive;

    // Resolve from CSS variables so the component inherits the page theme.
    // Fallbacks are neutral and readable on both light and dark backgrounds.
    const bgPrimary   = getCSSVar("--color-background-primary",   getCSSVar("--background-color", "#ffffff"));
    const bgSecondary = getCSSVar("--color-background-secondary",  getCSSVar("--minima-secondary-color", "#f5f5f5"));
    const textPrimary = getCSSVar("--color-text-primary",          getCSSVar("--text-color", "#1a1a1a"));
    const textSecond  = getCSSVar("--color-text-secondary",        getCSSVar("--minima-secondary-color", "#555555"));
    const textThird   = getCSSVar("--color-text-tertiary",         "#aaaaaa");
    const borderSoft  = getCSSVar("--color-border-tertiary",       getCSSVar("--border-color-muted", "#e0e0e0"));
    const borderMid   = getCSSVar("--color-border-secondary",      getCSSVar("--border-color", "#cccccc"));

    const fill   = isActive ? textPrimary : isDimmed ? bgSecondary : bgPrimary;
    const stroke = isActive ? textPrimary : isDimmed ? borderSoft  : borderMid;
    const textC  = isActive ? bgPrimary   : isDimmed ? textThird   : textSecond;

    const x = b.x - BLOCK_W / 2;
    const y = b.y - BLOCK_H / 2;
    const r = BLOCK_R;

    // Rounded rect
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + BLOCK_W - r, y);
    ctx.quadraticCurveTo(x + BLOCK_W, y,            x + BLOCK_W, y + r);
    ctx.lineTo(x + BLOCK_W,           y + BLOCK_H - r);
    ctx.quadraticCurveTo(x + BLOCK_W, y + BLOCK_H,  x + BLOCK_W - r, y + BLOCK_H);
    ctx.lineTo(x + r,                 y + BLOCK_H);
    ctx.quadraticCurveTo(x,           y + BLOCK_H,  x, y + BLOCK_H - r);
    ctx.lineTo(x,                     y + r);
    ctx.quadraticCurveTo(x,           y,             x + r, y);
    ctx.closePath();

    ctx.fillStyle   = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth   = isActive ? 1.5 : 0.5;
    ctx.stroke();

    // Label — word-wrapped
    const font = getCSSVar("--font-sans", "sans-serif");
    ctx.font         = `${isActive ? 500 : 400} 11px ${font}`;
    ctx.fillStyle    = textC;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";

    const maxW  = BLOCK_W - 12;
    const words = b.name.split(" ");
    const lines = [];
    let line    = "";
    words.forEach(w => {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else                                              { line = test; }
    });
    lines.push(line);

    const lh     = 13;
    const startY = b.y - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, b.x, startY + i * lh));
  }


  // ══════════════════════════════════════════════════════════════════════════
  // PHYSICS
  // Lifted blocks spring upward; resting blocks fall under gravity + spring.
  // ══════════════════════════════════════════════════════════════════════════

  function physics() {
    blocks.forEach(b => {
      const targetX = b.lifted ? (b.floatX !== undefined ? b.floatX : b.x) : (b.groundX !== undefined ? b.groundX : b.x);
      const targetY = b.lifted ? b.floatY : b.groundY;

      if (!b.vx) b.vx = 0;

      const dx = targetX - b.x;
      const dy = targetY - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Scale spring stiffness with distance — blocks farther away accelerate faster.
      // Base k + bonus proportional to distance, capped so it doesn't overshoot.
      const distScale = Math.min(1 + dist / 120, 4.0);

      b.vx += dx * 0.1 * distScale;
      b.vx *= DAMPING;
      if (Math.abs(b.vx) > MAX_SPEED * distScale) b.vx = Math.sign(b.vx) * MAX_SPEED * distScale;
      b.x += b.vx;

      if (b.lifted) {
        b.vy += dy * FLOAT_K * distScale;
        b.vy += (Math.random() - 0.5) * DRIFT;
      } else {
        b.vy += GRAVITY;
        b.vy += dy * GROUND_K * distScale;
      }

      b.vy *= DAMPING;
      if (Math.abs(b.vy) > MAX_SPEED * distScale) b.vy = Math.sign(b.vy) * MAX_SPEED * distScale;
      b.y += b.vy;

      // Ceiling / floor clamps
      const top = BLOCK_H / 2 + GAP;
      if (b.y < top)                                { b.y = top;                                b.vy =  Math.abs(b.vy) * 0.3; }
      if (b.y > canvas.height - BLOCK_H / 2 - GAP) { b.y = canvas.height - BLOCK_H / 2 - GAP; b.vy = -Math.abs(b.vy) * 0.2; }
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // ANIMATION LOOP
  // ══════════════════════════════════════════════════════════════════════════

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    physics();
    blocks.forEach(drawBlock);
    animId = requestAnimationFrame(tick);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // PANEL
  // ══════════════════════════════════════════════════════════════════════════

  function showPanelDefault() {
    panel.innerHTML = `<p style="font-size:13px;color:inherit;opacity:0.4;line-height:1.5;">Select a project above or click a skill to explore.</p>`;
  }

  function showPanelProject(p) {
    const subs = (p.subprojects || []).length
      ? `<p style="font-size:11px;color:var(--color-text-tertiary,#aaa);margin:8px 0 3px;">subprojects</p><div style="display:flex;flex-wrap:wrap;gap:4px;">${p.subprojects.map(s => tag(s, true)).join(" ")}</div>`
      : "";

    const titleEl = p.repo
      ? `<a href="${p.repo}" style="font-size:14px;font-weight:600;color:inherit;margin:0 0 6px;display:block;text-decoration:none;border-bottom:1px solid currentColor;padding-bottom:4px;">${p.name} ↗</a>`
      : `<p style="font-size:14px;font-weight:600;color:inherit;margin:0 0 6px;">${p.name}</p>`;
    panel.innerHTML = `
      ${titleEl}
      <div class="sb-desc" style="font-size:12px;color:inherit;opacity:0.7;line-height:1.7;margin:0;overflow-y:auto;flex:1;">${p.description || ""}</div>
      ${subs}
    `;
  }

  function showPanelSkill(b) {
    const projectTags = b.projects.length
      ? b.projects.map(p => tag(p)).join(" ")
      : `<span style="font-size:12px;color:var(--color-text-tertiary,#aaa);">no linked projects</span>`;

    panel.innerHTML = `
      <p style="font-size:14px;font-weight:600;color:inherit;margin:0 0 4px;">${b.name}</p>
      <p style="font-size:11px;color:inherit;opacity:0.45;margin:0 0 8px;">skill</p>
      <p style="font-size:11px;color:inherit;opacity:0.45;margin:0 0 4px;">used in</p>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">${projectTags}</div>
    `;
  }

  function tag(label, muted) {
    return `<span style="font-size:11px;padding:2px 7px;border-radius:4px;border:1px solid currentColor;color:inherit;opacity:${muted ? "0.4" : "0.8"};background:transparent;">${label}</span>`;
  }


  // ══════════════════════════════════════════════════════════════════════════
  // SELECTION HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  function clearSelection() {
    selectedProject = null;
    selectedSkill   = null;
    updateTabStates();
    updateBlockTargets();
  }


  // ══════════════════════════════════════════════════════════════════════════
  // EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  function bindEvents(skillsData, projectsData) {
    canvas.addEventListener("click", e => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top)  * scaleY;

      let hit = null;
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        if (mx >= b.x - BLOCK_W / 2 && mx <= b.x + BLOCK_W / 2 &&
            my >= b.y - BLOCK_H / 2 && my <= b.y + BLOCK_H / 2) {
          hit = b; break;
        }
      }

      if (hit) {
        if (selectedSkill === hit.name) {
          clearSelection();
          showPanelDefault();
        } else {
          selectedProject = null;
          selectedSkill   = hit.name;
          updateTabStates();
          updateBlockTargets();
          showPanelSkill(hit);
        }
      }
    });

    // Touch tap — forward to click handler via synthetic hit-test
    canvas.addEventListener("touchend", e => {
      e.preventDefault();
      const t    = e.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (t.clientX - rect.left) * scaleX;
      const my = (t.clientY - rect.top)  * scaleY;

      let hit = null;
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        if (mx >= b.x - BLOCK_W / 2 && mx <= b.x + BLOCK_W / 2 &&
            my >= b.y - BLOCK_H / 2 && my <= b.y + BLOCK_H / 2) {
          hit = b; break;
        }
      }

      if (hit) {
        if (selectedSkill === hit.name) {
          clearSelection();
          showPanelDefault();
        } else {
          selectedProject = null;
          selectedSkill   = hit.name;
          updateTabStates();
          updateBlockTargets();
          showPanelSkill(hit);
        }
      }
    }, { passive: false });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeCanvas();
        spawnBlocks(skillsData);
        updateBlockTargets();
      }, 150);
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // YAML PARSER
  // Parses the projects.yml structure without any external dependency.
  // Handles the fields used in projects.yml: name, type, repo, skills,
  // description (block scalar "|"), subprojects (inline sequence).
  // ══════════════════════════════════════════════════════════════════════════

  function parseYaml(input) {
    // Input is the JS object produced by Jekyll's `jsonify` filter.
    // Shape: { projects: [ { name, type, repo, skills, description, subprojects }, ... ] }
    const rawProjects = input.projects || input || [];

    const projectsData = rawProjects
      .filter(p => (p.type || []).some(t => t === "presentation" || t === "index"))
      .map(p => ({
        name:        p.name        || "",
        description: (p.description || "").trim(),
        repo:        p.repo        || null,
        skills:      p.skills      || [],
        subprojects: p.subprojects || [],
        type:        p.type        || [],
      }));

    const skillMap = {};
    rawProjects.forEach(p => {
      (p.skills || []).forEach(s => {
        const key = s.trim().toLowerCase();
        if (!skillMap[key]) skillMap[key] = { name: s.trim(), projects: [] };
        if (p.name && !skillMap[key].projects.includes(p.name))
          skillMap[key].projects.push(p.name);
      });
    });
    const skillsData = Object.values(skillMap).sort((a, b) => a.name.localeCompare(b.name));

    return { projectsData, skillsData };
  }



  // ── Public API ─────────────────────────────────────────────────────────────
  return { init };

})();