# Graphiti Enhanced Search Migration Plan

## Project Overview

**Objective**: Replace the current `real_llm_kg_script.py` implementation with enhanced Graphiti search capabilities while maintaining 100% GUI compatibility and zero production risk.

**Approach**: Parallel implementation with drop-in replacement strategy

**Timeline**: 4 weeks (18 developer days)

**Risk Level**: LOW (comprehensive fallback mechanisms)

---

## Executive Summary

This migration plan implements enhanced Graphiti search (MMR/RRF modes, edge-node mixing) for the GUI application while maintaining the exact signature of `get_real_kg_data(question, uri, user, password, database)`. The parallel implementation approach ensures zero risk to existing functionality with automatic fallback capabilities.

---

## Phase 1: Foundation Development (Week 1)

### **Task 1.1: Create Enhanced Wrapper Architecture**
**Owner**: Senior Developer  
**Duration**: 2 days  
**Priority**: Critical

**Deliverables**:
- [ ] Create `graphiti_enhanced_wrapper.py` file
- [ ] Implement exact signature match: `def get_real_kg_data(question: str, uri: str, user: str, password: str, database: str) -> Dict[str, Any]`
- [ ] Add comprehensive error handling and logging
- [ ] Implement fallback mechanism to original `real_llm_kg_script.py`

**Acceptance Criteria**:
```python
# Must maintain exact signature compatibility
from graphiti_enhanced_wrapper import get_real_kg_data
result = get_real_kg_data("test question", "bolt://localhost:7687", "neo4j", "password", "neo4j")
assert isinstance(result, dict)
assert "success" in result
assert "context" in result
assert "answer" in result
```

### **Task 1.2: Implement Safe Import System**
**Owner**: Senior Developer  
**Duration**: 1 day  
**Priority**: Critical

**Deliverables**:
- [ ] Safe imports with try/catch for all Graphiti dependencies
- [ ] Feature detection for enhanced search capabilities
- [ ] Version compatibility checking
- [ ] Graceful degradation flags

**Implementation**:
```python
try:
    from graphiti_core.search.search_config_recipes import (
        COMBINED_HYBRID_SEARCH_MMR,
        COMBINED_HYBRID_SEARCH_RRF,
    )
    ENHANCED_SEARCH_AVAILABLE = True
except ImportError:
    ENHANCED_SEARCH_AVAILABLE = False
    # Fallback to original implementation
```

### **Task 1.3: Build Circuit Breaker System**
**Owner**: Senior Developer  
**Duration**: 1 day  
**Priority**: High

**Deliverables**:
- [ ] Circuit breaker class for automatic fallback
- [ ] Failure threshold configuration (default: 5 failures)
- [ ] Recovery timeout mechanism (default: 5 minutes)
- [ ] Metrics collection for monitoring

### **Task 1.4: Create Unit Test Foundation**
**Owner**: Senior Developer  
**Duration**: 1 day  
**Priority**: High

**Deliverables**:
- [ ] Test framework setup
- [ ] Mock Graphiti responses
- [ ] Fallback mechanism tests
- [ ] Error handling validation tests

---

## Phase 2: Enhanced Search Implementation (Week 2)

### **Task 2.1: Implement Enhanced Search Core**
**Owner**: Senior Developer  
**Duration**: 3 days  
**Priority**: Critical

**Deliverables**:
- [ ] Async implementation of enhanced search
- [ ] MMR and RRF mode support
- [ ] Edge-node mixing functionality (default: 6 edges, 2 nodes)
- [ ] Protected API usage with fallback to public API

**Technical Specifications**:
```python
async def _get_enhanced_kg_data(
    question: str, 
    uri: str, 
    user: str, 
    password: str, 
    database: str,
    mode: str = "mmr",
    edge_node_mix: str = "6,2"
) -> Dict[str, Any]:
```

### **Task 2.2: Implement Sync-to-Async Wrapper**
**Owner**: Senior Developer  
**Duration**: 1 day  
**Priority**: Critical

**Deliverables**:
- [ ] Synchronous wrapper maintaining GUI compatibility
- [ ] Proper asyncio event loop handling
- [ ] Thread safety for GUI integration
- [ ] Performance optimization

### **Task 2.3: Return Value Compatibility**
**Owner**: Senior Developer  
**Duration**: 1 day  
**Priority**: Critical

**Deliverables**:
- [ ] Maintain original return structure
- [ ] Add optional enhanced metadata
- [ ] Backward compatibility validation
- [ ] JSON serialization compatibility

**Return Structure**:
```python
{
    # ORIGINAL FIELDS (GUI compatibility)
    "success": bool,
    "context": str,
    "answer": str,
    "citations": List[str],
    
    # ENHANCED FIELDS (optional)
    "_enhanced": {
        "search_mode": str,
        "edge_count": int,
        "node_count": int,
        "fallback_used": bool
    }
}
```

---

## Phase 3: Integration and Testing (Week 3)

### **Task 3.1: GUI Integration Testing**
**Owner**: Full-stack Developer + QA Engineer  
**Duration**: 2 days  
**Priority**: Critical

**Deliverables**:
- [ ] Drop-in replacement testing in staging environment
- [ ] GUI functionality validation
- [ ] User workflow testing
- [ ] Performance comparison with original implementation

**Test Scenarios**:
- [ ] Normal search queries
- [ ] Edge cases (empty results, long queries)
- [ ] Error conditions (database unavailable)
- [ ] Concurrent user sessions
- [ ] Fallback mechanism activation

### **Task 3.2: Performance Validation**
**Owner**: Senior Developer  
**Duration**: 2 days  
**Priority**: High

**Deliverables**:
- [ ] Response time benchmarking
- [ ] Memory usage profiling
- [ ] Concurrent load testing
- [ ] Performance regression testing

**Performance Targets**:
- Response time: ≤ 110% of original
- Memory usage: ≤ 120% of original
- Concurrent users: Support same load as original
- Fallback overhead: < 50ms

### **Task 3.3: End-to-End Integration Tests**
**Owner**: QA Engineer  
**Duration**: 1 day  
**Priority**: High

**Deliverables**:
- [ ] Complete user journey testing
- [ ] Database connection scenarios
- [ ] Network failure simulation
- [ ] Rollback procedure validation

---

## Phase 4: Production Deployment (Week 4)

### **Task 4.1: Monitoring and Alerting Setup**
**Owner**: DevOps Engineer  
**Duration**: 2 days  
**Priority**: Critical

**Deliverables**:
- [ ] Real-time monitoring dashboard
- [ ] Alert configuration for failure thresholds
- [ ] Performance metrics collection
- [ ] Rollback automation triggers

**Monitoring Metrics**:
```yaml
metrics:
  - enhanced_search_success_rate (target: >95%)
  - fallback_usage_rate (target: <5%)
  - response_time_p95 (target: <1500ms)
  - gui_error_rate (target: <0.1%)
  - memory_usage (target: <150MB)
```

### **Task 4.2: Gradual Production Rollout**
**Owner**: Senior Developer + DevOps Engineer  
**Duration**: 2 days  
**Priority**: Critical

**Rollout Strategy**:
- [ ] Day 1: 10% traffic to enhanced wrapper
- [ ] Day 1 (4 hours later): 25% traffic if metrics are green
- [ ] Day 2: 50% traffic if no issues detected
- [ ] Day 2 (4 hours later): 100% traffic if performance targets met

**Go/No-Go Criteria for Each Phase**:
- Zero GUI errors
- Response time within 110% of baseline
- Enhanced search success rate > 95%
- No memory leaks detected

### **Task 4.3: Production Validation and Tuning**
**Owner**: Senior Developer  
**Duration**: 1 day  
**Priority**: High

**Deliverables**:
- [ ] Real-world performance validation
- [ ] User feedback collection
- [ ] Performance tuning based on production data
- [ ] Documentation updates

---

## Risk Management

### **High-Priority Risks and Mitigations**

#### **Risk 1: GUI Integration Failure**
- **Probability**: Low
- **Impact**: High
- **Mitigation**: Comprehensive testing + automatic rollback
- **Rollback Time**: 30 seconds

#### **Risk 2: Performance Degradation**
- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**: Performance monitoring + circuit breaker
- **Threshold**: >50% response time increase triggers fallback

#### **Risk 3: Dependency Issues**
- **Probability**: Low
- **Impact**: High
- **Mitigation**: Safe imports + feature detection
- **Fallback**: Automatic switch to original implementation

### **Rollback Procedures**

#### **Immediate Rollback (30 seconds)**
```bash
# Emergency rollback
export ENHANCED_SEARCH_ENABLED=false
systemctl restart gui-application
# Verify GUI functionality
curl -X POST /api/search -d '{"question":"test"}'
```

#### **Gradual Rollback (5 minutes)**
```bash
# Reduce traffic gradually
export ENHANCED_SEARCH_PERCENTAGE=50  # Then 25, then 0
# Monitor for 2 minutes between changes
```

---

## Success Criteria

### **Functional Requirements**
- [ ] GUI maintains 100% existing functionality
- [ ] Enhanced search provides improved result quality
- [ ] Zero production incidents during migration
- [ ] Fallback mechanisms work reliably

### **Performance Requirements**
- [ ] Response time ≤ 110% of original implementation
- [ ] Memory usage ≤ 120% of original implementation
- [ ] 99.9% uptime maintained
- [ ] Enhanced search success rate ≥ 95%

### **Business Requirements**
- [ ] User satisfaction improvement (measured via feedback)
- [ ] Search result relevance improvement
- [ ] Foundation for future enhancements established
- [ ] Zero business disruption

---

## Resource Requirements

### **Team Composition**
- **Senior Developer**: 10 days (enhanced search implementation)
- **Full-stack Developer**: 3 days (GUI integration)
- **QA Engineer**: 3 days (testing and validation)
- **DevOps Engineer**: 2 days (deployment and monitoring)

### **Infrastructure Requirements**
- Staging environment matching production
- Monitoring and alerting infrastructure
- Rollback automation capabilities
- Performance testing tools

### **Dependencies**
- Graphiti Core library (current version)
- Access to Neo4j database
- GUI application codebase
- Deployment pipeline access

---

## Approval Checklist

**Technical Approval**:
- [ ] Architecture review completed
- [ ] Risk assessment approved
- [ ] Rollback procedures validated
- [ ] Resource allocation confirmed

**Business Approval**:
- [ ] Timeline acceptable
- [ ] Success criteria agreed upon
- [ ] Risk tolerance confirmed
- [ ] Budget approved

**Stakeholder Sign-off**:
- [ ] Engineering Manager: ________________
- [ ] Product Owner: ________________
- [ ] DevOps Lead: ________________
- [ ] QA Lead: ________________

---

## Next Steps After Approval

1. **Immediate (Day 1)**: Kick-off meeting with all stakeholders
2. **Week 1**: Begin Phase 1 development
3. **Week 2**: Daily progress reviews and risk assessment
4. **Week 3**: Staging deployment and integration testing
5. **Week 4**: Production deployment with monitoring

**Project Manager**: [To be assigned]  
**Technical Lead**: [To be assigned]  
**Success Metrics Owner**: [To be assigned]

---

## Appendix A: Implementation Templates

### **A.1 Enhanced Wrapper Template**
```python
# graphiti_enhanced_wrapper.py
import asyncio
import logging
import os
import time
from typing import Dict, Any, Optional

# Safe imports with fallback
try:
    from graphiti_core import Graphiti
    from graphiti_core.search.search_config_recipes import (
        COMBINED_HYBRID_SEARCH_MMR,
        COMBINED_HYBRID_SEARCH_RRF,
    )
    ENHANCED_SEARCH_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Enhanced search not available: {e}")
    ENHANCED_SEARCH_AVAILABLE = False

class SearchCircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 300):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.last_failure_time = 0
        self.recovery_timeout = recovery_timeout

    def should_use_enhanced_search(self) -> bool:
        if self.failure_count >= self.failure_threshold:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.failure_count = 0
                return True
            return False
        return True

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()

    def record_success(self):
        self.failure_count = max(0, self.failure_count - 1)

# Global circuit breaker instance
circuit_breaker = SearchCircuitBreaker()

def get_real_kg_data(question: str, uri: str, user: str, password: str, database: str) -> Dict[str, Any]:
    """
    Drop-in replacement for real_llm_kg_script.get_real_kg_data()
    Maintains exact signature compatibility with enhanced search capabilities.
    """
    # Feature flags
    enhanced_enabled = os.getenv("ENHANCED_SEARCH_ENABLED", "true").lower() == "true"

    if enhanced_enabled and ENHANCED_SEARCH_AVAILABLE and circuit_breaker.should_use_enhanced_search():
        try:
            result = asyncio.run(_get_enhanced_kg_data(question, uri, user, password, database))
            circuit_breaker.record_success()
            return result
        except Exception as e:
            logging.error(f"Enhanced search failed: {e}")
            circuit_breaker.record_failure()

    # Fallback to original implementation
    logging.info("Using fallback to original implementation")
    from real_llm_kg_script import get_real_kg_data as original_get_real_kg_data
    result = original_get_real_kg_data(question, uri, user, password, database)

    # Add fallback indicator
    if isinstance(result, dict):
        result["_enhanced"] = {"fallback_used": True}

    return result

async def _get_enhanced_kg_data(question: str, uri: str, user: str, password: str, database: str) -> Dict[str, Any]:
    """Internal async implementation with enhanced Graphiti search"""
    # Default parameters optimized for GUI usage
    mode = "mmr"  # Diversity-focused for better user experience
    edge_node_mix = "6,2"  # Balanced ratio

    # Implementation details here...
    # [Full implementation would be added in actual development]

    return {
        "success": True,
        "context": "enhanced context",
        "answer": "enhanced answer",
        "citations": ["[1]", "[2]"],
        "_enhanced": {
            "search_mode": mode,
            "edge_node_mix": edge_node_mix,
            "fallback_used": False
        }
    }
```

### **A.2 Testing Template**
```python
# test_enhanced_wrapper.py
import unittest
from unittest.mock import patch, MagicMock
from graphiti_enhanced_wrapper import get_real_kg_data

class TestEnhancedWrapper(unittest.TestCase):

    def test_signature_compatibility(self):
        """Test that function signature matches original exactly"""
        with patch('graphiti_enhanced_wrapper.asyncio.run') as mock_run:
            mock_run.return_value = {"success": True, "context": "", "answer": "", "citations": []}

            result = get_real_kg_data("test", "uri", "user", "pass", "db")

            self.assertIsInstance(result, dict)
            self.assertIn("success", result)
            self.assertIn("context", result)
            self.assertIn("answer", result)
            self.assertIn("citations", result)

    def test_fallback_mechanism(self):
        """Test fallback to original implementation"""
        with patch('graphiti_enhanced_wrapper.ENHANCED_SEARCH_AVAILABLE', False):
            with patch('real_llm_kg_script.get_real_kg_data') as mock_original:
                mock_original.return_value = {"success": True, "context": "original"}

                result = get_real_kg_data("test", "uri", "user", "pass", "db")

                self.assertTrue(result["_enhanced"]["fallback_used"])
                mock_original.assert_called_once()
```

### **A.3 Monitoring Configuration**
```yaml
# monitoring_config.yml
alerts:
  - name: enhanced_search_failure_rate
    query: rate(enhanced_search_failures[5m]) > 0.05
    severity: critical
    action: page_oncall

  - name: response_time_degradation
    query: histogram_quantile(0.95, rate(search_duration_seconds_bucket[5m])) > 1.5
    severity: warning
    action: slack_notification

  - name: fallback_usage_spike
    query: rate(fallback_usage_total[5m]) > 0.1
    severity: warning
    action: slack_notification

dashboards:
  - name: Enhanced Search Performance
    panels:
      - enhanced_search_success_rate
      - response_time_percentiles
      - fallback_usage_rate
      - memory_usage
      - concurrent_users
```

---

## Appendix B: Deployment Checklist

### **Pre-Deployment Checklist**
- [ ] All unit tests passing (>95% coverage)
- [ ] Integration tests completed successfully
- [ ] Performance benchmarks within acceptable range
- [ ] Staging environment validation complete
- [ ] Rollback procedures tested and verified
- [ ] Monitoring and alerting configured
- [ ] Team trained on new system
- [ ] Documentation updated

### **Deployment Day Checklist**
- [ ] Backup current production configuration
- [ ] Deploy enhanced wrapper to production
- [ ] Verify monitoring systems are active
- [ ] Start with 10% traffic allocation
- [ ] Monitor metrics for 2 hours
- [ ] Increase to 25% if metrics are green
- [ ] Continue gradual rollout per plan
- [ ] Document any issues or observations

### **Post-Deployment Checklist**
- [ ] 100% traffic successfully migrated
- [ ] All performance targets met
- [ ] User feedback collected and analyzed
- [ ] System stability confirmed over 48 hours
- [ ] Team retrospective completed
- [ ] Lessons learned documented
- [ ] Success metrics reported to stakeholders

---

**Document Version**: 1.0
**Last Updated**: [Current Date]
**Next Review**: Weekly during implementation
**Approval Required**: YES - Please review and approve to proceed
