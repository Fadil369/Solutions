# 🧪 Comprehensive Test Suite

Tests validate the skill system's decision-making, error handling, and performance.

## Running Tests

```bash
python3 test/validate_all.py      # Run all tests
python3 test/validate_decisions.py # Decision framework tests
python3 test/validate_errors.py    # Error recovery tests
python3 test/validate_perf.py      # Performance tests
```

## Test Categories

### 1. Decision Framework Tests
- Trigger phrase matching accuracy
- Anti-pattern detection
- Context-aware recommendations
- Cross-skill integration

### 2. Error Recovery Tests
- Error classification accuracy
- Recovery strategy selection
- Escalation thresholds
- Learning from patterns

### 3. Performance Tests
- Index operations < 100ms
- Search across all skills < 50ms
- Memory usage bounded
- Concurrent access safe

## Success Criteria

- ✅ 95%+ trigger phrase match rate
- ✅ < 5% false positive anti-pattern detection
- ✅ 90%+ correct error classification
- ✅ All operations under performance budgets
