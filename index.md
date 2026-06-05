---
layout: default
title: Ben Horley-Owen
description: Security Engineer | DevSecOps Engineer | Infrastructure Security | Security Operations Engineer | DFIR Analyst
---

## About

{{ site.data.info.bio }}<br>

## Projects & Skills
this is not yet mobile compatible<br>
Select a project! some are indexes with their own subprojects. Index projects take on the skills of their subprojects, which can be accessed from the block bottom left.<br>
<div class="skills-canvas-wrapper">
  <div class="skills-project-panel"></div>
  <div class="skills-canvas-area">
    <canvas id="skills-canvas"></canvas>
  </div>
</div>

<style>
.skills-canvas-wrapper {
  display: flex;
  min-height: 200px;
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