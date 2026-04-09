#!/usr/bin/env python3
"""Quick index rebuild."""
import json
import sys
from pathlib import Path
from datetime import datetime

SKILLS_DIR = Path(__file__).parent.parent / "skills"
INDEX_PATH = SKILLS_DIR / "index.json"

# The 26 skills in the system
SKILLS = [
    "accessibility-pattern-library", "api-integration-layer", "authentication-flow-designer",
    "component-lifecycle-manager", "contextual-ambiguity-detector", "cursor-position-tracker",
    "dashboard-composition-engine", "database-schema-designer", "data-migration-orchestrator",
    "data-visualization-engine", "deployment-pipeline-architect", "error-message-optimizer",
    "error-recovery-orchestrator", "feature-flag-system", "file-upload-orchestrator",
    "form-pattern-engine", "interactive-prototype-builder", "mobile-gesture-handler",
    "multi-tenant-architecture", "notification-system-builder", "offline-sync-engine",
    "performance-budget-enforcer", "real-time-collaboration-engine", "search-experience-designer",
    "state-machine-designer", "workflow-automation-designer",
]

CATEGORIES = {
    "accessibility-pattern-library": "Accessibility", "api-integration-layer": "API & Integration",
    "authentication-flow-designer": "Security & Auth", "component-lifecycle-manager": "Architecture",
    "contextual-ambiguity-detector": "Code Quality", "cursor-position-tracker": "Development Tools",
    "dashboard-composition-engine": "Analytics & Dashboards", "database-schema-designer": "Database & Data",
    "data-migration-orchestrator": "Database & Data", "data-visualization-engine": "Visualization",
    "deployment-pipeline-architect": "DevOps & Infra", "error-message-optimizer": "UX & Polish",
    "error-recovery-orchestrator": "Reliability", "feature-flag-system": "DevOps & Infra",
    "file-upload-orchestrator": "File Handling", "form-pattern-engine": "UI Patterns",
    "interactive-prototype-builder": "Prototyping", "mobile-gesture-handler": "Mobile & Touch",
    "multi-tenant-architecture": "Architecture", "notification-system-builder": "Communication",
    "offline-sync-engine": "Offline & Sync", "performance-budget-enforcer": "Performance",
    "real-time-collaboration-engine": "Real-time", "search-experience-designer": "Search & Discovery",
    "state-machine-designer": "Architecture", "workflow-automation-designer": "Automation",
}

PRIORITIES = {
    "authentication-flow-designer": "high", "api-integration-layer": "high",
    "database-schema-designer": "high", "deployment-pipeline-architect": "high",
    "multi-tenant-architecture": "high", "state-machine-designer": "high",
    "accessibility-pattern-library": "high", "component-lifecycle-manager": "medium",
    "form-pattern-engine": "medium", "dashboard-composition-engine": "medium",
    "data-visualization-engine": "medium", "notification-system-builder": "medium",
    "search-experience-designer": "medium", "file-upload-orchestrator": "medium",
    "mobile-gesture-handler": "medium", "workflow-automation-designer": "medium",
    "error-message-optimizer": "medium", "interactive-prototype-builder": "medium",
    "performance-budget-enforcer": "medium", "data-migration-orchestrator": "medium",
    "feature-flag-system": "medium", "error-recovery-orchestrator": "medium",
    "offline-sync-engine": "medium", "contextual-ambiguity-detector": "low",
    "cursor-position-tracker": "low", "real-time-collaboration-engine": "low",
}


def parse_frontmatter(filepath):
    content = filepath.read_text(encoding="utf-8")
    meta = {}
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            for line in content[3:end].strip().split("\n"):
                if ":" in line:
                    k, v = line.split(":", 1)
                    v = v.strip().strip('"').strip("'")
                    if v.lower() == "true": v = True
                    elif v.lower() == "false": v = False
                    meta[k.strip()] = v
    return meta


skills = {}
for sid in SKILLS:
    skill_md = SKILLS_DIR / sid / "SKILL.md"
    if not skill_md.exists():
        continue
    meta = parse_frontmatter(skill_md)
    files = []
    skill_dir = SKILLS_DIR / sid
    for p in sorted(skill_dir.rglob("*")):
        if p.is_file() and not p.name.startswith("."):
            files.append(str(p.relative_to(skill_dir)))
    skills[sid] = {
        "id": sid,
        "name": meta.get("name", sid),
        "description": meta.get("description", ""),
        "version": meta.get("version", "1.0.0"),
        "author": meta.get("author", "workspace"),
        "category": CATEGORIES.get(sid, "Uncategorized"),
        "priority": PRIORITIES.get(sid, "medium"),
        "activated": meta.get("activated", False),
        "activated_at": meta.get("activated_at"),
        "files": files,
        "path": f"skills/{sid}",
    }

index = {
    "version": "2.0.0",
    "updated": datetime.utcnow().isoformat() + "Z",
    "total_skills": len(skills),
    "activated_skills": sum(1 for s in skills.values() if s.get("activated")),
    "skills": skills,
    "errors": [],
}

INDEX_PATH.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")
print(f"✅ Rebuilt index: {len(skills)} skills")
