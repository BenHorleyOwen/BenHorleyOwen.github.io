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
      padding:      "10px 12px",
      borderBottom: "0.5px solid var(--color-border-tertiary, #e0e0e0)",
      background:   "var(--color-background-secondary, #f5f5f5)",
    });
  }

  function applyTabStyles(btn, active) {
    Object.assign(btn.style, {
      fontSize:     "12px",
      padding:      "4px 10px",
      borderRadius: "6px",
      border:       active
        ? "0.5px solid var(--color-text-primary, #111)"
        : "0.5px solid var(--color-border-secondary, #ccc)",
      background:   active
        ? "var(--color-text-primary, #111)"
        : "var(--color-background-primary, #fff)",
      color:        active
        ? "var(--color-background-primary, #fff)"
        : "var(--color-text-secondary, #555)",
      cursor:       "pointer",
      fontFamily:   "var(--font-sans, sans-serif)",
      lineHeight:   "1.4",
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // CANVAS SIZING
  // ══════════════════════════════════════════════════════════════════════════

  function resizeCanvas() {
    const area    = canvas.parentElement;
    canvas.width  = area.clientWidth  || 600;
    canvas.height = Math.max(380, area.clientHeight || area.clientWidth * 0.6);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK CREATION
  // Blocks are arranged in a grid that fills from the bottom up.
  // groundY is their resting position; floatY is where they rise to.
  // ══════════════════════════════════════════════════════════════════════════

  function spawnBlocks(skillsData) {
    const cols     = Math.max(1, Math.floor((canvas.width + GAP) / (BLOCK_W + GAP)));
    const rows     = Math.ceil(skillsData.length / cols);
    const floorY   = canvas.height - BLOCK_H / 2 - GAP;
    const floatBand = canvas.height * 0.45; // how high lifted blocks can rise

    blocks = skillsData.map((skill, i) => {
      const col     = i % cols;
      const row     = Math.floor(i / cols);
      const groundY = floorY - row * (BLOCK_H + GAP);

      // Stagger float heights slightly so lifted blocks don't all pile up
      const floatY  = GAP + BLOCK_H / 2 + floatBand * (0.2 + 0.6 * (col / Math.max(cols - 1, 1)));

      return {
        name:     skill.name,
        projects: Array.isArray(skill.projects) ? skill.projects : [],
        x:        GAP + col * (BLOCK_W + GAP) + BLOCK_W / 2,
        y:        groundY,
        vy:       0,
        groundY,
        floatY,
        lifted:   false,
      };
    });
  }

  function updateBlockTargets() {
    blocks.forEach(b => {
      if (selectedProject) {
        b.lifted = b.projects.includes(selectedProject);
      } else if (selectedSkill) {
        b.lifted = b.name === selectedSkill;
      } else {
        b.lifted = false;
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

    const fill   = isActive  ? getCSSVar("--color-text-primary",         "#111111")
                 : isDimmed  ? getCSSVar("--color-background-secondary",  "#f5f5f5")
                 :             getCSSVar("--color-background-primary",    "#ffffff");

    const stroke = isActive  ? getCSSVar("--color-text-primary",         "#111111")
                 : isDimmed  ? getCSSVar("--color-border-tertiary",       "#e0e0e0")
                 :             getCSSVar("--color-border-secondary",      "#cccccc");

    const textC  = isActive  ? getCSSVar("--color-background-primary",   "#ffffff")
                 : isDimmed  ? getCSSVar("--color-text-tertiary",         "#aaaaaa")
                 :             getCSSVar("--color-text-secondary",        "#555555");

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
      if (b.lifted) {
        // Spring toward floatY + gentle drift
        b.vy += (b.floatY - b.y) * FLOAT_K;
        b.vy += (Math.random() - 0.5) * DRIFT;
      } else {
        // Gravity + spring back to ground
        b.vy += GRAVITY;
        b.vy += (b.groundY - b.y) * GROUND_K;
      }

      b.vy *= DAMPING;
      if (Math.abs(b.vy) > MAX_SPEED) b.vy = Math.sign(b.vy) * MAX_SPEED;
      b.y += b.vy;

      // Ceiling / floor clamps
      const top = BLOCK_H / 2 + GAP;
      if (b.y < top)                              { b.y = top;                              b.vy =  Math.abs(b.vy) * 0.3; }
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
    panel.innerHTML = `<p class="spp-placeholder" style="font-size:13px;color:var(--color-text-tertiary,#aaa);line-height:1.5;">Select a project above or click a skill to explore.</p>`;
  }

  function showPanelProject(p) {
    const skillTags = (p.skills || []).length
      ? p.skills.map(s => tag(s)).join(" ")
      : `<span style="font-size:12px;color:var(--color-text-tertiary,#aaa);">none listed</span>`;

    const repoLink = p.repo
      ? `<a href="${p.repo}" style="display:block;margin-top:10px;font-size:11px;color:var(--color-text-info,#1a73e8);word-break:break-all;">${p.repo.replace("https://github.com/", "github: ")}</a>`
      : "";

    const subs = (p.subprojects || []).length
      ? `<p style="font-size:11px;color:var(--color-text-tertiary,#aaa);margin:8px 0 3px;">subprojects</p><div style="display:flex;flex-wrap:wrap;gap:4px;">${p.subprojects.map(s => tag(s, true)).join(" ")}</div>`
      : "";

    panel.innerHTML = `
      <p style="font-size:14px;font-weight:500;color:var(--color-text-primary,#111);margin:0 0 6px;">${p.name}</p>
      <p style="font-size:12px;color:var(--color-text-secondary,#555);line-height:1.6;margin:0 0 10px;">${p.description || ""}</p>
      <p style="font-size:11px;color:var(--color-text-tertiary,#aaa);margin:0 0 4px;">skills</p>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">${skillTags}</div>
      ${subs}
      ${repoLink}
    `;
  }

  function showPanelSkill(b) {
    const projectTags = b.projects.length
      ? b.projects.map(p => tag(p)).join(" ")
      : `<span style="font-size:12px;color:var(--color-text-tertiary,#aaa);">no linked projects</span>`;

    panel.innerHTML = `
      <p style="font-size:14px;font-weight:500;color:var(--color-text-primary,#111);margin:0 0 4px;">${b.name}</p>
      <p style="font-size:11px;color:var(--color-text-tertiary,#aaa);margin:0 0 8px;">skill</p>
      <p style="font-size:11px;color:var(--color-text-tertiary,#aaa);margin:0 0 4px;">used in</p>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">${projectTags}</div>
    `;
  }

  function tag(label, muted) {
    return `<span style="font-size:11px;padding:2px 7px;border-radius:5px;border:0.5px solid var(--color-border-secondary,#ccc);color:${muted ? "var(--color-text-tertiary,#aaa)" : "var(--color-text-secondary,#555)"};background:var(--color-background-primary,#fff);">${label}</span>`;
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
  const raw = typeof input === "string" ? JSON.parse(input) : input;
  const rawProjects = raw.projects || raw;

    const projectsData = rawProjects
      .filter(p => (p.type || []).includes("presentation") || (p.type || []).includes("index"))
      .map(p => ({
        name:        p.name || "",
        description: (p.description || "").trim(),
        repo:        p.repo || null,
        skills:      p.skills || [],
        subprojects: p.subprojects || [],
        type:        p.type || [],
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

  function getIndent(line) {
    return line.match(/^(\s*)/)[1].length;
  }

  function parseInlineKV(str, obj) {
    const m = str.match(/^(\w[\w\s-]*):\s*(.*)/);
    if (!m) return;
    const k = m[1].trim().toLowerCase().replace(/\s+/g, "_");
    const v = m[2].trim();
    if (v.startsWith("[")) obj[k] = parseInlineList(v);
    else if (v === "null") obj[k] = null;
    else obj[k] = v.replace(/^["']|["']$/g, "");
  }

  function parseInlineList(str) {
    const inner = str.replace(/^\[|\]$/g, "").trim();
    if (!inner) return [];
    return inner.split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }


  // ── Public API ─────────────────────────────────────────────────────────────
  return { init };

})();