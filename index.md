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

<div class="skills-canvas-wrapper">
  <div class="skills-project-panel"></div>
  <div class="skills-canvas-area">
    <canvas id="skills-canvas"></canvas>
  </div>
</div>

<style>
.skills-canvas-wrapper {
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color, #e2e8f0);
  margin: 1.5rem 0;
}
.skills-project-panel {
  width: 200px;
  min-width: 200px;
  padding: 1.25rem;
  border-right: 1px solid var(--border-color, #e2e8f0);
  overflow-y: auto;
  font-size: 0.85rem;
}
.skills-canvas-area {
  flex: 1;
  min-width: 0;
  min-height: 420px;
}
canvas#skills-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
<script src="assets/js/skills-bubbles.js"></script>
<script>
  const yaml = {{ site.data.projects | jsonify }};
  SkillsBubbles.init(yaml);
</script>

## Projects

{% for project in site.data.projects.projects %}
### [{{ project.name }}]({{ project.repo }})
{{ project.description }}
{% endfor %}