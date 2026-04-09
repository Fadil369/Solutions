#!/usr/bin/env python3
"""
Comprehensive Test Suite for Skill System
Validates:
- All 26 skills exist and are properly structured
- Index is valid and complete
- Decision frameworks are documented
- Anti-patterns are defined
- Error recovery skills have escalation chains
"""
import json
import sys
import os
from pathlib import Path
from datetime import datetime

# Colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

SKILLS_DIR = Path(__file__).parent.parent / "skills"
INDEX_PATH = SKILLS_DIR / "index.json"

EXPECTED_SKILLS = [
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

ERROR_RECOVERY_SKILLS = [
    "error-recovery-orchestrator", "offline-sync-engine", "real-time-collaboration-engine",
    "data-migration-orchestrator", "deployment-pipeline-architect"
]

results = {"passed": 0, "failed": 0, "warnings": 0, "details": []}


def test(name, condition, warning=False):
    if condition:
        print(f"  {GREEN}✅{RESET} {name}")
        results["passed"] += 1
    elif warning:
        print(f"  {YELLOW}⚠️{RESET}  {name}")
        results["warnings"] += 1
    else:
        print(f"  {RED}❌{RESET} {name}")
        results["failed"] += 1
    results["details"].append({"test": name, "passed": condition, "warning": warning})


def section(name):
    print(f"\n{BLUE}━━━ {name} ━━━{RESET}")


def parse_frontmatter(content):
    meta = {}
    if content.startswith("---"):
        end = content.find("---", 3)
        if end > 0:
            for line in content[3:end].strip().split("\n"):
                if ":" in line:
                    k, v = line.split(":", 1)
                    v = v.strip().strip('"').strip("'")
                    if v.lower() == "true":
                        v = True
                    elif v.lower() == "false":
                        v = False
                    meta[k.strip()] = v
    return meta


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section("INDEX VALIDATION")
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

try:
    index = json.loads(INDEX_PATH.read_text())
    test("Index.json exists and is valid JSON", True)
    test(f"Version is 2.0.0", index.get("version") == "2.0.0")
    test(f"Total skills count is 26", index.get("total_skills") == 26)
    test(f"No errors in index", len(index.get("errors", [])) == 0)
except FileNotFoundError:
    test("Index.json exists", False)
    index = {"skills": {}}
except json.JSONDecodeError as e:
    test("Index.json is valid JSON", False)
    index = {"skills": {}}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section("SKILL COMPLETENESS")
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

index_skills = set(index.get("skills", {}).keys())
expected_set = set(EXPECTED_SKILLS)

missing_from_index = expected_set - index_skills
extra_in_index = index_skills - expected_set

test(f"All 26 expected skills in index", len(missing_from_index) == 0)
if missing_from_index:
    print(f"      Missing: {', '.join(sorted(missing_from_index))}")

test(f"No unexpected skills in index", len(extra_in_index) == 0, warning=True)
if extra_in_index:
    print(f"      Extra: {', '.join(sorted(extra_in_index))}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section("SKILL STRUCTURE")
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

for skill_id in EXPECTED_SKILLS:
    skill_dir = SKILLS_DIR / skill_id
    skill_md = skill_dir / "SKILL.md"
    
    exists = skill_md.exists()
    test(f"{skill_id}: SKILL.md exists", exists)
    
    if not exists:
        continue
    
    content = skill_md.read_text(encoding="utf-8")
    meta = parse_frontmatter(content)
    
    test(f"{skill_id}: Has 'name' field", bool(meta.get("name")))
    test(f"{skill_id}: Has 'description' field", bool(meta.get("description")))
    test(f"{skill_id}: Has 'version' field", bool(meta.get("version")))
    test(f"{skill_id}: Frontmatter not empty", len(meta) > 0)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section("INDEX ENTRIES")
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

for skill_id in EXPECTED_SKILLS:
    if skill_id not in index.get("skills", {}):
        continue
    
    entry = index["skills"][skill_id]
    test(f"{skill_id}: Has 'id' in index", bool(entry.get("id")))
    test(f"{skill_id}: Has 'description' in index", bool(entry.get("description")))
    test(f"{skill_id}: Has 'category' in index", bool(entry.get("category")))
    test(f"{skill_id}: Has 'priority' in index", entry.get("priority") in ("high", "medium", "low"))
    test(f"{skill_id}: Has 'path' in index", bool(entry.get("path")))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section("INDEX-METADATA CONSISTENCY")
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

for skill_id in EXPECTED_SKILLS:
    skill_md = SKILLS_DIR / skill_id / "SKILL.md"
    if not skill_md.exists() or skill_id not in index.get("skills", {}):
        continue
    
    content = skill_md.read_text(encoding="utf-8")
    meta = parse_frontmatter(content)
    entry = index["skills"][skill_id]
    
    fm_name = meta.get("name", "")
    idx_name = entry.get("name", "")
    test(f"{skill_id}: Name matches (frontmatter='{fm_name}' vs index='{idx_name}')", fm_name == idx_name)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section("DECISION FRAMEWORKS")
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

for skill_id in EXPECTED_SKILLS:
    skill_md = SKILLS_DIR / skill_id / "SKILL.md"
    if not skill_md.exists():
        continue
    
    content = skill_md.read_text(encoding="utf-8").lower()
    
    has_decision = any(kw in content for kw in [
        "decision framework", "when to use", "decision tree",
        "decision criteria", "when to apply"
    ])
    test(f"{skill_id}: Has decision framework", has_decision)
    
    has_antipattern = any(kw in content for kw in [
        "anti-pattern", "antipattern", "when not to use",
        "avoid", "common mistakes", "don't use when"
    ])
    test(f"{skill_id}: Has anti-patterns", has_antipattern)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section("TRIGGER PHRASES")
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

for skill_id in EXPECTED_SKILLS:
    skill_md = SKILLS_DIR / skill_id / "SKILL.md"
    if not skill_md.exists():
        continue
    
    content = skill_md.read_text(encoding="utf-8")
    has_triggers = "trigger phrase" in content.lower() or "## Trigger" in content
    test(f"{skill_id}: Has trigger phrases", has_triggers)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section("ERROR RECOVERY SKILLS")
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

for skill_id in ERROR_RECOVERY_SKILLS:
    skill_md = SKILLS_DIR / skill_id / "SKILL.md"
    if not skill_md.exists():
        continue
    
    content = skill_md.read_text(encoding="utf-8").lower()
    
    has_escalation = any(kw in content for kw in [
        "escalat", "retry", "fallback", "recovery strategy",
        "circuit break", "backoff"
    ])
    test(f"{skill_id}: Has escalation/recovery patterns", has_escalation)
    
    has_classification = any(kw in content for kw in [
        "error type", "error classification", "severity",
        "error category", "recoverable"
    ])
    test(f"{skill_id}: Has error classification", has_classification)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section("CATEGORIES & PRIORITIES")
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

categories = {}
priorities = {"high": 0, "medium": 0, "low": 0}

for skill_id, entry in index.get("skills", {}).items():
    cat = entry.get("category", "Uncategorized")
    categories[cat] = categories.get(cat, 0) + 1
    pri = entry.get("priority", "medium")
    priorities[pri] = priorities.get(pri, 0) + 1

test(f"Has at least 5 categories", len(categories) >= 5)
test(f"Has high-priority skills", priorities["high"] > 0)
test(f"Has medium-priority skills", priorities["medium"] > 0)
test(f"All priorities valid", sum(priorities.values()) == len(index.get("skills", {})))

print(f"\n      Categories: {json.dumps(categories, indent=2)}")
print(f"      Priorities: {json.dumps(priorities)}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section("FILESYSTEM INTEGRITY")
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

manage_script = Path(__file__).parent.parent / "scripts" / "manage-skills.py"
test("manage-skills.py exists", manage_script.exists())

if manage_script.exists():
    content = manage_script.read_text()
    test("manage-skills.py has 'index' command", "index" in content)
    test("manage-skills.py has 'search' command", "search" in content)
    test("manage-skills.py has 'validate' command", "validate" in content)
    test("manage-skills.py has 'stats' command", "stats" in content)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUMMARY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

print(f"\n{'='*50}")
print(f"{GREEN}PASSED: {results['passed']}{RESET}  {RED}FAILED: {results['failed']}{RESET}  {YELLOW}WARNINGS: {results['warnings']}{RESET}")
print(f"{'='*50}")

sys.exit(1 if results["failed"] > 0 else 0)
