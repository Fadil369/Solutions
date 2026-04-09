#!/usr/bin/env python3
"""
Skills Index Manager
Usage:
  python3 scripts/manage-skills.py index          # Rebuild index.json
  python3 scripts/manage-skills.py search "query"  # Search skills
  python3 scripts/manage-skills.py validate        # Validate all skills
  python3 scripts/manage-skills.py stats            # Show statistics
"""
import json
import sys
import os
import re
from pathlib import Path
from datetime import datetime

SKILLS_DIR = Path(__file__).parent.parent / "skills"
INDEX_PATH = SKILLS_DIR / "index.json"

CATEGORY_MAP = {
    "authentication-flow-designer": "Security & Auth",
    "accessibility-pattern-library": "Accessibility",
    "error-message-optimizer": "UX & Polish",
    "interactive-prototype-builder": "Prototyping",
    "api-integration-layer": "API & Integration",
    "contextual-ambiguity-detector": "Code Quality",
    "database-schema-designer": "Database & Data",
    "form-pattern-engine": "UI Patterns",
    "deployment-pipeline-architect": "DevOps & Infra",
    "mobile-gesture-handler": "Mobile & Touch",
    "state-machine-designer": "Architecture",
    "file-upload-orchestrator": "File Handling",
    "notification-system-builder": "Communication",
    "search-experience-designer": "Search & Discovery",
    "dashboard-composition-engine": "Analytics & Dashboards",
    "workflow-automation-designer": "Automation",
    "multi-tenant-architecture": "Architecture",
    "performance-budget-enforcer": "Performance",
    "data-visualization-engine": "Visualization",
    "component-lifecycle-manager": "Architecture",
    "real-time-collaboration-engine": "Real-time",
    "data-migration-orchestrator": "Database & Data",
    "feature-flag-system": "DevOps & Infra",
    "error-recovery-orchestrator": "Reliability",
    "offline-sync-engine": "Offline & Sync",
    "cursor-position-tracker": "Development Tools",
}

PRIORITY_MAP = {
    "authentication-flow-designer": "high",
    "accessibility-pattern-library": "high",
    "error-message-optimizer": "medium",
    "interactive-prototype-builder": "medium",
    "api-integration-layer": "high",
    "contextual-ambiguity-detector": "low",
    "database-schema-designer": "high",
    "form-pattern-engine": "medium",
    "deployment-pipeline-architect": "high",
    "mobile-gesture-handler": "medium",
    "state-machine-designer": "high",
    "file-upload-orchestrator": "medium",
    "notification-system-builder": "medium",
    "search-experience-designer": "medium",
    "dashboard-composition-engine": "medium",
    "workflow-automation-designer": "medium",
    "multi-tenant-architecture": "high",
    "performance-budget-enforcer": "medium",
    "data-visualization-engine": "medium",
    "component-lifecycle-manager": "medium",
    "real-time-collaboration-engine": "low",
    "data-migration-orchestrator": "medium",
    "feature-flag-system": "medium",
    "error-recovery-orchestrator": "medium",
    "offline-sync-engine": "medium",
    "cursor-position-tracker": "low",
}


def parse_skill_md(filepath: Path) -> dict:
    """Extract metadata from SKILL.md frontmatter and content."""
    content = filepath.read_text(encoding="utf-8")
    result = {}

    # Parse YAML-like frontmatter
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            frontmatter = content[3:end].strip()
            for line in frontmatter.split("\n"):
                if ":" in line:
                    key, val = line.split(":", 1)
                    val = val.strip().strip('"').strip("'")
                    if val.lower() == "true":
                        val = True
                    elif val.lower() == "false":
                        val = False
                    result[key.strip()] = val

    # Extract description from first paragraph after frontmatter
    after_front = content[end + 3:] if content.startswith("---") else content
    paragraphs = [p.strip() for p in after_front.split("\n\n") if p.strip()]
    for p in paragraphs:
        if not p.startswith("#") and not p.startswith("|") and len(p) > 30:
            result.setdefault("_description_extracted", p[:200])
            break

    return result


def build_index() -> dict:
    """Build the complete skills index."""
    skills = {}
    errors = []

    for skill_dir in sorted(SKILLS_DIR.iterdir()):
        if not skill_dir.is_dir() or skill_dir.name.startswith("."):
            continue

        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            errors.append(f"Missing SKILL.md in {skill_dir.name}")
            continue

        try:
            meta = parse_skill_md(skill_md)
            name = meta.get("name", skill_dir.name)
            skills[skill_dir.name] = {
                "id": skill_dir.name,
                "name": name,
                "description": meta.get("description", meta.get("_description_extracted", "")),
                "version": meta.get("version", "1.0.0"),
                "author": meta.get("author", "workspace"),
                "category": CATEGORY_MAP.get(skill_dir.name, "Uncategorized"),
                "priority": PRIORITY_MAP.get(skill_dir.name, "medium"),
                "activated": meta.get("activated", False),
                "activated_at": meta.get("activated_at"),
                "files": [
                    str(p.relative_to(skill_dir))
                    for p in sorted(skill_dir.rglob("*"))
                    if p.is_file() and not p.name.startswith(".")
                ],
                "path": f"skills/{skill_dir.name}",
            }
        except Exception as e:
            errors.append(f"Error parsing {skill_dir.name}: {e}")

    index = {
        "version": "2.0.0",
        "updated": datetime.utcnow().isoformat() + "Z",
        "total_skills": len(skills),
        "activated_skills": sum(1 for s in skills.values() if s.get("activated")),
        "skills": skills,
        "errors": errors,
    }

    return index


def search_skills(query: str):
    """Search skills by name, description, or category."""
    index = json.loads(INDEX_PATH.read_text())
    query_lower = query.lower()
    results = []

    for skill_id, skill in index["skills"].items():
        searchable = f"{skill_id} {skill['name']} {skill['description']} {skill['category']}".lower()
        if query_lower in searchable:
            results.append(skill)

    return results


def validate_skills():
    """Validate all skills have required fields and valid structure."""
    index = json.loads(INDEX_PATH.read_text())
    issues = []

    for skill_id, skill in index["skills"].items():
        if not skill.get("description"):
            issues.append(f"⚠️  {skill_id}: Missing description")
        if not skill.get("files"):
            issues.append(f"⚠️  {skill_id}: No files found")
        elif "SKILL.md" not in [f.split("/")[-1] for f in skill["files"]]:
            issues.append(f"❌ {skill_id}: Missing SKILL.md")

    return issues


def show_stats():
    """Show skill statistics."""
    index = json.loads(INDEX_PATH.read_text())
    categories = {}
    priorities = {"high": 0, "medium": 0, "low": 0}

    for skill in index["skills"].values():
        cat = skill.get("category", "Uncategorized")
        categories[cat] = categories.get(cat, 0) + 1
        pri = skill.get("priority", "medium")
        priorities[pri] = priorities.get(pri, 0) + 1

    return {
        "total": index["total_skills"],
        "activated": index["activated_skills"],
        "categories": categories,
        "priorities": priorities,
    }


def cmd_activate(skill_id: str):
    """Mark a skill as activated."""
    index = json.loads(INDEX_PATH.read_text())
    if skill_id not in index["skills"]:
        print(f"❌ Skill '{skill_id}' not found")
        return

    index["skills"][skill_id]["activated"] = True
    index["skills"][skill_id]["activated_at"] = datetime.utcnow().isoformat() + "Z"
    index["activated_skills"] = sum(1 for s in index["skills"].values() if s.get("activated"))
    INDEX_PATH.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")
    print(f"✅ Activated: {skill_id}")


def cmd_deactivate(skill_id: str):
    """Mark a skill as deactivated."""
    index = json.loads(INDEX_PATH.read_text())
    if skill_id not in index["skills"]:
        print(f"❌ Skill '{skill_id}' not found")
        return

    index["skills"][skill_id]["activated"] = False
    index["skills"][skill_id]["activated_at"] = None
    index["activated_skills"] = sum(1 for s in index["skills"].values() if s.get("activated"))
    INDEX_PATH.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")
    print(f"✅ Deactivated: {skill_id}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "index":
        index = build_index()
        INDEX_PATH.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")
        print(f"✅ Built index: {index['total_skills']} skills, {index['activated_skills']} activated")
        if index.get("errors"):
            for e in index["errors"]:
                print(f"  ⚠️  {e}")

    elif cmd == "search":
        if len(sys.argv) < 3:
            print("Usage: manage-skills.py search <query>")
            sys.exit(1)
        results = search_skills(sys.argv[2])
        if results:
            for s in results:
                activated = "🟢" if s.get("activated") else "⚪"
                print(f"  {activated} [{s['id']}] {s['name']} - {s['category']} ({s['priority']})")
                print(f"    {s['description'][:100]}...")
        else:
            print("No results found.")

    elif cmd == "validate":
        issues = validate_skills()
        if issues:
            for i in issues:
                print(i)
        else:
            print("✅ All skills valid")

    elif cmd == "stats":
        stats = show_stats()
        print(f"Total: {stats['total']} | Activated: {stats['activated']}")
        print("\nBy Category:")
        for cat, count in sorted(stats["categories"].items()):
            print(f"  {cat}: {count}")
        print("\nBy Priority:")
        for pri, count in stats["priorities"].items():
            print(f"  {pri}: {count}")

    elif cmd == "activate":
        if len(sys.argv) < 3:
            print("Usage: manage-skills.py activate <skill-id>")
            sys.exit(1)
        cmd_activate(sys.argv[2])

    elif cmd == "deactivate":
        if len(sys.argv) < 3:
            print("Usage: manage-skills.py deactivate <skill-id>")
            sys.exit(1)
        cmd_deactivate(sys.argv[2])

    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)
