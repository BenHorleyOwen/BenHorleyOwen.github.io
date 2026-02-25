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

{% assign skills_by_category = site.data.skills.skills | group_by: "category" %}
{% for category in skills_by_category %}
### {{ category.name | capitalize }}
{% for skill in category.items %}
- **{{ skill.name }}** ({{ skill.level }})
{% endfor %}
{% endfor %}

## Projects

{% for project in site.data.projects.projects %}
### [{{ project.name }}]({{ project.repo }})
{{ project.description }}
{% endfor %}