---
layout: default
title: Ben Horley-Owen
description: Security Engineer | DevSecOps Engineer | Infrastructure Security | Security Operations Engineer | DFIR Analyst
---

## About

{{ site.data.info.bio }}

**Location:** {{ site.data.info.location }}
**Email:** [{{ site.data.info.email }}](mailto:{{ site.data.info.email }})

## Skills
<div class="skills-canvas-wrapper" style="border-radius:12px;overflow:hidden;background:#f8fafc;border:1px solid #e2e8f0;margin:1.5rem 0;">
  <canvas id="skills-canvas" style="display:block;width:100%;"></canvas>
  <div class="skills-legend" style="display:flex;flex-wrap:wrap;gap:0.5rem 1rem;padding:0.75rem 1rem;border-top:1px solid #e2e8f0;background:#fff;font-family:'Segoe UI',sans-serif;font-size:0.8rem;color:#475569;"></div>
</div>

<script src="assets/js/skills-bubbles.js"></script>
<script>
  const skills = [
    {% for skill in site.data.skills.skills %}
      {
        name: {{ skill.name | jsonify }},
        level: {{ skill.level | jsonify }},
        category: {{ skill.category | jsonify }}
        projects: {{ skill.projects | jsonify }}
      }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ];
  SkillsBubbles.init(skills);
</script>

## Projects

{% for project in site.data.projects.projects %}
### [{{ project.name }}]({{ project.repo }})
{{ project.description }}
{% endfor %}