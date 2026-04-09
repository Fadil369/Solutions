#!/usr/bin/env python3
"""Quick test runner - runs all validation tests."""
import sys
import os
from pathlib import Path
import json

# Add workspace to path
sys.path.insert(0, str(Path(__file__).parent.parent))

def run_all():
    results = {"passed": 0, "failed": 0, "errors": []}
    
    # Test 1: Index exists and is valid JSON
    try:
        index_path = Path(__file__).parent.parent / "skills" / "index.json"
        index = json.loads(index_path.read_text())
        assert index["version"] == "2.0.0"
        assert index["total_skills"] >= 26
        print("✅ Index valid: {} skills".format(index["total_skills"]))
        results["passed"] += 1
    except Exception as e:
        print(f"❌ Index test failed: {e}")
        results["failed"] += 1
        results["errors"].append(str(e))
    
    # Test 2: All skills have SKILL.md
    try:
        skills_dir = Path(__file__).parent.parent / "skills"
        missing = []
        for skill_id in index.get("skills", {}):
            skill_md = skills_dir / skill_id / "SKILL.md"
            if not skill_md.exists():
                missing.append(skill_id)
        if missing:
            print(f"❌ Missing SKILL.md: {missing}")
            results["failed"] += 1
        else:
            print(f"✅ All {index['total_skills']} skills have SKILL.md")
            results["passed"] += 1
    except Exception as e:
        print(f"❌ SKILL.md check failed: {e}")
        results["failed"] += 1
    
    # Test 3: manage-skills.py exists
    try:
        script = Path(__file__).parent.parent / "scripts" / "manage-skills.py"
        assert script.exists()
        print("✅ manage-skills.py exists")
        results["passed"] += 1
    except:
        print("❌ manage-skills.py missing")
        results["failed"] += 1
    
    # Test 4: Active skills have proper frontmatter
    try:
        for skill_id in index.get("skills", {}):
            skill_md = skills_dir / skill_id / "SKILL.md"
            content = skill_md.read_text()
            assert content.startswith("---"), f"{skill_id}: missing frontmatter"
            assert "name:" in content, f"{skill_id}: missing name"
            assert "description:" in content, f"{skill_id}: missing description"
        print(f"✅ All skills have valid frontmatter")
        results["passed"] += 1
    except Exception as e:
        print(f"❌ Frontmatter check failed: {e}")
        results["failed"] += 1
    
    # Test 5: Core skills exist (26 total)
    try:
        expected_skills = [
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
        index_skills = set(index.get("skills", {}).keys())
        missing = set(expected_skills) - index_skills
        extra = index_skills - set(expected_skills)
        if missing:
            print(f"❌ Missing expected skills: {missing}")
            results["failed"] += 1
        elif extra:
            print(f"❌ Unexpected skills: {extra}")
            results["failed"] += 1
        else:
            print(f"✅ All 26 expected skills present")
            results["passed"] += 1
    except Exception as e:
        print(f"❌ Skill completeness check failed: {e}")
        results["failed"] += 1
    
    # Summary
    print(f"\n📊 Results: {results['passed']} passed, {results['failed']} failed")
    return results["failed"] == 0


if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)
