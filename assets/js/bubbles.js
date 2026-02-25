/**
 * bubbles.js — Animated skill bubble cloud
 *
 * Bubbles float around the stage. When a job title filter is selected,
 * matching bubbles highlight and rise to the top of the stage while
 * unmatched bubbles dim and sink.
 */

(function () {
  "use strict";

  /* ---- Config ---- */
  const SIZES = { expert: 88, advanced: 72, intermediate: 58 };
  const FLOAT_SPEED = 0.35;           // px per frame baseline
  const WOBBLE_STRENGTH = 0.8;
  const FILTER_RISE_ZONE = 90;        // px — top zone bubbles float into
  const STAGE_TOP_PADDING = 90;       // clear the filter label area

  const stage = document.getElementById("bubble-stage");
  if (!stage) return;

  const skillsData  = JSON.parse(stage.dataset.skills);
  const filterBtns  = document.querySelectorAll(".filter-btn");

  let activeFilter  = null;
  let bubbles       = [];
  let rafId         = null;
  let stageW        = 0;
  let stageH        = 0;

  /* ---- Build bubble DOM ---- */
  function buildBubbles() {
    stageW = stage.offsetWidth;
    stageH = stage.offsetHeight;

    // Clear existing
    bubbles.forEach(b => b.el.remove());
    bubbles = [];

    skillsData.forEach((skill, i) => {
      const size = SIZES[skill.level] || 64;
      const el   = document.createElement("div");
      el.className    = "bubble";
      el.textContent  = skill.name;
      el.dataset.level    = skill.level;
      el.dataset.category = skill.category;
      el.dataset.jobs     = JSON.stringify(skill.job_titles);

      // Random start position (avoid top zone)
      const x = Math.random() * (stageW - size);
      const y = STAGE_TOP_PADDING + Math.random() * (stageH - STAGE_TOP_PADDING - size);

      el.style.width  = size + "px";
      el.style.height = size + "px";
      el.style.left   = x + "px";
      el.style.top    = y + "px";
      el.style.padding = "6px";

      stage.appendChild(el);

      bubbles.push({
        el,
        skill,
        size,
        x, y,
        vx: (Math.random() - 0.5) * FLOAT_SPEED * 2,
        vy: (Math.random() - 0.5) * FLOAT_SPEED * 2,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleFreq: 0.008 + Math.random() * 0.005,
        highlighted: false,
        dimmed: false,
        // Target y for filtered state
        targetY: null,
      });
    });
  }

  /* ---- Filter logic ---- */
  function applyFilter(jobId) {
    activeFilter = jobId;

    // Update stage label
    stage.dataset.filterLabel = jobId
      ? filterBtns[0].closest(".skills-filter")
          ?.querySelector(`.filter-btn[data-job="${jobId}"]`)
          ?.textContent || jobId
      : "← skills ↗";

    stage.classList.toggle("has-filter", !!jobId);

    // Sort out highlighted vs dimmed
    let highlightedCount = 0;

    bubbles.forEach(b => {
      if (!jobId) {
        b.highlighted = false;
        b.dimmed      = false;
        b.targetY     = null;
        b.el.classList.remove("highlighted", "dimmed");
        return;
      }

      const jobs = b.skill.job_titles || [];
      if (jobs.includes(jobId)) {
        b.highlighted = true;
        b.dimmed      = false;
        b.el.classList.add("highlighted");
        b.el.classList.remove("dimmed");

        // Assign staggered rise positions at top
        b.targetY = STAGE_TOP_PADDING + (highlightedCount % 2) * (b.size * 0.5);
        highlightedCount++;
      } else {
        b.highlighted = false;
        b.dimmed      = true;
        b.el.classList.remove("highlighted");
        b.el.classList.add("dimmed");
        b.targetY = null;
      }
    });

    // Spread highlighted bubbles horizontally
    const highlighted = bubbles.filter(b => b.highlighted);
    const spacing     = stageW / (highlighted.length + 1);
    highlighted.forEach((b, i) => {
      b.targetX = spacing * (i + 1) - b.size / 2;
    });
  }

  /* ---- Animation loop ---- */
  let frame = 0;

  function tick() {
    frame++;
    stageW = stage.offsetWidth;
    stageH = stage.offsetHeight;

    bubbles.forEach(b => {
      if (b.highlighted && b.targetX !== undefined) {
        // Lerp to target position in rise zone
        b.x += (b.targetX - b.x) * 0.06;
        const tY = STAGE_TOP_PADDING + 20 +
                   Math.sin(frame * b.wobbleFreq + b.wobblePhase) * 10;
        b.y += (tY - b.y) * 0.05;
      } else if (!b.dimmed) {
        // Free float with gentle wobble
        const wobbleX = Math.sin(frame * b.wobbleFreq + b.wobblePhase) * WOBBLE_STRENGTH;
        const wobbleY = Math.cos(frame * b.wobbleFreq * 0.7 + b.wobblePhase) * WOBBLE_STRENGTH;

        b.x += b.vx + wobbleX * 0.05;
        b.y += b.vy + wobbleY * 0.05;

        // Bounce off walls
        const minY = activeFilter ? STAGE_TOP_PADDING + 80 : STAGE_TOP_PADDING;

        if (b.x < 0)             { b.x = 0;              b.vx *= -1; }
        if (b.x > stageW - b.size){ b.x = stageW - b.size; b.vx *= -1; }
        if (b.y < minY)           { b.y = minY;           b.vy = Math.abs(b.vy); }
        if (b.y > stageH - b.size){ b.y = stageH - b.size; b.vy = -Math.abs(b.vy); }
      } else {
        // Dimmed: drift slowly to bottom half
        const sinkTarget = stageH * 0.6 + Math.random() * stageH * 0.3;
        b.y += (sinkTarget - b.y) * 0.005;
      }

      b.el.style.left = b.x + "px";
      b.el.style.top  = b.y + "px";
    });

    rafId = requestAnimationFrame(tick);
  }

  /* ---- Button handlers ---- */
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const job = btn.dataset.job;
      if (activeFilter === job) {
        // Deselect
        filterBtns.forEach(b => b.classList.remove("active"));
        applyFilter(null);
      } else {
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        applyFilter(job);
      }
    });
  });

  /* ---- Resize handling ---- */
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      buildBubbles();
      if (activeFilter) applyFilter(activeFilter);
    }, 200);
  });

  /* ---- Init ---- */
  buildBubbles();

  // Set initial stage label
  stage.dataset.filterLabel = "↑  filter by role to highlight skills";

  // Start loop
  rafId = requestAnimationFrame(tick);

})();
