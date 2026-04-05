---
layout: default
title: Ben Horley-Owen
description: Security Engineer | DevSecOps Engineer | Infrastructure Security | Security Operations Engineer | DFIR Analyst
---

## About

{{ site.data.info.bio }}<br>
<br>
**Location:** {{ site.data.info.location }}<br>
**Email:** [{{ site.data.info.email }}](mailto:{{ site.data.info.email }})<br>
<br>

## Projects & Skills
this is not yet mobile compatible<br>
<div class="skills-canvas-wrapper">
  <div class="skills-project-panel"></div>
  <div class="skills-canvas-area">
    <canvas id="skills-canvas"></canvas>
  </div>
</div>

<style>
.skills-canvas-wrapper {
  display: flex;
  height: 420px;
  overflow: hidden;
  border: 1px solid var(--border);
  margin: 1.5rem 0;
  background: var(--surface);
}
.skills-project-panel {
  width: 200px;
  min-width: 200px;
  padding: 1rem;
  border-right: 1px solid var(--border);
  overflow: hidden;
  font-family: var(--font-body);
  font-size: 0.82rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: var(--text);
}
.skills-canvas-area { flex: 1; min-width: 0; }
canvas#skills-canvas { display: block; width: 100%; height: 100%; }
.skills-project-bar { margin-bottom: 0.5rem; }
</style>

<script src="assets/js/skills-bubbles.js"></script>
<script>
  const yaml = {{ site.data.projects | jsonify }};
  SkillsBubbles.init(yaml);
</script>

