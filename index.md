---
layout: default
title: Ben Horley-Owen
description: Security Engineer | DevSecOps Engineer | Infrastructure Security | Security Operations Engineer | DFIR Analyst
---

## About

{{ site.data.info.bio }}

**Location:** {{ site.data.info.location }}
**Email:** [{{ site.data.info.email }}](mailto:{{ site.data.info.email }})

## Skills debug

<div class="skills-canvas-wrapper" style="display:flex;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;margin:1.5rem 0;background:#f8fafc;">

  <div class="skills-project-panel" style="width:200px;min-width:200px;padding:1.25rem;background:#fff;border-right:1px solid #e2e8f0;overflow-y:auto;font-family:'Segoe UI',sans-serif;font-size:0.85rem;"></div>

  <div class="skills-canvas-area" style="flex:1;min-width:0;display:flex;flex-direction:column;">
    <canvas id="skills-canvas" style="display:block;width:100%;"></canvas>
    <div class="skills-legend" style="display:flex;flex-wrap:wrap;gap:0.4rem 1rem;padding:0.65rem 1rem;border-top:1px solid #e2e8f0;background:#fff;font-family:'Segoe UI',sans-serif;font-size:0.78rem;color:#64748b;"></div>
  </div>

</div>

<div id="sb-diag" style="background:#fef9c3;border:1px solid #ca8a04;padding:0.75rem;font-family:monospace;font-size:0.75rem;margin-top:0.5rem;border-radius:6px;"></div>

<style>
.spp-placeholder { color:#94a3b8; text-align:center; margin-top:2rem; line-height:1.6; }
.spp-title       { margin:0 0 0.75rem; font-size:0.95rem; font-weight:700; color:#1e293b; }
.spp-list        { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:0.35rem; }
.spp-item        { padding:0.4rem 0.6rem; background:#f1f5f9; border-left:3px solid #3b82f6; border-radius:4px; color:#334155; }
.spp-empty       { color:#94a3b8; border-left-color:#cbd5e1; }
.legend-item     { display:inline-flex; align-items:center; gap:0.35rem; }
.legend-dot      { width:9px; height:9px; border-radius:50%; background:#3b82f6; flex-shrink:0; }
</style>

<script src="assets/js/skills-bubbles.js"></script>
<script>
  const diag = document.getElementById("sb-diag");

  const checks = {
    "SkillsBubbles defined": typeof SkillsBubbles !== "undefined",
    "#skills-canvas found":  !!document.getElementById("skills-canvas"),
    ".skills-project-panel": !!document.querySelector(".skills-project-panel"),
    ".skills-canvas-area":   !!document.querySelector(".skills-canvas-area"),
  };

  const skills = [
    {% for skill in site.data.skills.skills %}
      {
        name: {{ skill.name | jsonify }},
        category: {{ skill.category | jsonify }},
        projects: {{ skill.projects | jsonify }}
      }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ];

  checks["skills array length"] = skills.length;
  checks["first skill"] = skills.length ? JSON.stringify(skills[0]) : "none";

  diag.innerHTML = Object.entries(checks)
    .map(([k,v]) => `<div style="color:${v === false ? '#dc2626' : '#15803d'}">${k}: <b>${v}</b></div>`)
    .join("");

  try {
    SkillsBubbles.init(skills);
    diag.innerHTML += `<div style="color:#15803d"><b>init() called successfully</b></div>`;
  } catch(e) {
    diag.innerHTML += `<div style="color:#dc2626"><b>init() error: ${e.message}</b></div>`;
  }
</script>

## Projects

{% for project in site.data.projects.projects %}
### [{{ project.name }}]({{ project.repo }})
{{ project.description }}
{% endfor %}