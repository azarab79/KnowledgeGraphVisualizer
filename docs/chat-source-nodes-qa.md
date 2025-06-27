# Chat Source Nodes - QA & Testing Documentation

## Feature Overview

The Chat Source Nodes feature enhances the Knowledge Graph Visualizer by displaying the graph nodes that contributed to each AI response, alongside traditional document sources. This provides users with transparent insight into how the knowledge graph influenced the AI's answers.

## Implementation Summary

### Architecture
- **Backend Integration**: Python script (`kg_qa_pipeline_enhanced.py`) extracts source nodes during graph querying
- **Proxy Server**: Node.js proxy forwards `sourceNodes` field from Python responses  
- **Frontend Components**: React components display nodes in a clean, accessible interface
- **Node Interaction**: Clicking nodes opens the existing NodeDetails modal for full exploration

### Key Components

#### 1. Backend Data Flow
- ✅ Python script extracts nodes used during knowledge graph queries
- ✅ Returns both `sourceDocuments` and `sourceNodes` in API responses
- ✅ Node.js proxy server properly forwards this data to frontend

#### 2. Frontend Components
- ✅ **MessageReferences**: Tabbed interface (Sources/Nodes/All) replacing DocumentReferences
- ✅ **NodeChip**: Compact, clickable chips displaying individual graph nodes
- ✅ **Performance Optimization**: React.memo, useMemo, useCallback for efficient rendering
- ✅ **Accessibility**: WCAG 2.1 AA compliant with axe-core testing

#### 3. User Experience Improvements
- ✅ **Compact Design**: 60% smaller node chips allowing more nodes per row
- ✅ **Progressive Disclosure**: Basic info in chip, full details in hover tooltip  
- ✅ **Smart Interaction**: Click-to-view with keyboard navigation support
- ✅ **Responsive Layout**: CSS clamps and breakpoints for different screen sizes

## Manual QA Checklist

### Pre-Testing Setup
- [ ] Ensure all servers are running:
  - Python backend (port 8000)
  - Node.js API server (port 3002) 
  - React frontend (port 5177)
- [ ] Verify knowledge graph data is loaded and accessible

### Core Functionality Testing

#### Test 1: Basic Source Nodes Display
1. **Action**: Send a chat message asking about the knowledge graph
   - Example: "Tell me about risk management systems"
2. **Expected Result**:
   - AI response appears with MessageReferences below
   - If nodes are returned: "Nodes (X)" tab visible
   - Compact node chips displayed showing node IDs and icons
3. **Verification**: 
   - [ ] Node chips are visually distinct and readable
   - [ ] Chip count matches number in tab
   - [ ] Icons are appropriate for node types

#### Test 2: Node Interaction
1. **Action**: Hover over a node chip
2. **Expected Result**: 
   - Tooltip appears showing node name, ID, type, and "Click to view details"
   - [ ] Tooltip is positioned correctly and readable
   - [ ] Information is accurate and complete
3. **Action**: Click on a node chip
4. **Expected Result**:
   - NodeDetails modal opens showing full node information
   - [ ] Modal contains correct node data
   - [ ] Modal is fully functional (close button, node relationships, etc.)

#### Test 3: Tabbed Interface
1. **Action**: Send a message that returns both documents and nodes
2. **Expected Result**: Three tabs appear: Sources, Nodes, All
   - [ ] Tab counts are accurate
   - [ ] Default tab (Sources) is selected
3. **Action**: Click different tabs
4. **Expected Result**:
   - [ ] Sources tab shows document icons
   - [ ] Nodes tab shows node chips  
   - [ ] All tab shows both sections with labels
   - [ ] Active tab is visually indicated

#### Test 4: Edge Cases
1. **Test**: Message with only documents (no nodes)
   - [ ] Only Sources tab appears
   - [ ] No JavaScript errors in console
2. **Test**: Message with only nodes (no documents)
   - [ ] Only Nodes tab appears  
   - [ ] No JavaScript errors in console
3. **Test**: Message with no sources or nodes
   - [ ] MessageReferences component doesn't render
   - [ ] Chat message appears normally

### Accessibility Testing

#### Keyboard Navigation
1. **Action**: Use Tab key to navigate to node chips
2. **Expected Result**: 
   - [ ] Node chips receive focus with visible indicator
   - [ ] Tab order is logical (left to right, top to bottom)
3. **Action**: Press Enter or Space on focused node chip
4. **Expected Result**:
   - [ ] NodeDetails modal opens (same as clicking)

#### Screen Reader Compatibility
1. **Test**: Ensure proper ARIA attributes
   - [ ] Tab elements have role="tab" and aria-selected
   - [ ] Tab panels have role="tabpanel" and proper labeling
   - [ ] Node chips have descriptive aria-labels
2. **Test**: Verify semantic structure
   - [ ] Heading hierarchy is logical
   - [ ] Interactive elements are properly labeled

#### Automated Accessibility
1. **Action**: Run axe-core tests
   ```bash
   npm test -- NodeChip.accessibility.test.jsx
   ```
2. **Expected Result**: 
   - [ ] All tests pass with no violations
   - [ ] WCAG 2.1 AA compliance verified

### Performance Testing

#### Load Testing
1. **Test**: Message with many nodes (10+ nodes)
   - [ ] Page remains responsive during rendering
   - [ ] No noticeable lag when switching tabs
   - [ ] Smooth scrolling in node container

#### Memory Testing  
1. **Test**: Send multiple messages with nodes
   - [ ] No memory leaks in browser dev tools
   - [ ] Component unmounting works correctly
   - [ ] No zombie event listeners

### Cross-Browser Testing
- [ ] **Chrome**: All functionality works correctly
- [ ] **Firefox**: All functionality works correctly  
- [ ] **Safari**: All functionality works correctly
- [ ] **Edge**: All functionality works correctly

### Mobile Responsiveness
- [ ] **Small screens**: Node chips scale appropriately
- [ ] **Touch interaction**: Tapping works as expected
- [ ] **Portrait/landscape**: Layout adapts correctly

## Known Issues & Limitations

### Current Limitations
1. **Node Icon Mapping**: Limited icon variety, defaults to system icon
2. **Tooltip Positioning**: May clip on screen edges in some cases
3. **Large Node Sets**: No pagination for 50+ nodes (though unlikely)

### Future Enhancements
1. **Filtering**: Search/filter nodes by type or properties
2. **Grouping**: Automatically group nodes by type/category
3. **Visualization**: Mini-graph preview of node relationships
4. **Caching**: Cache node data for faster subsequent loads

## Testing Environment

### Test Data Requirements
- Knowledge graph with diverse node types (System, Risk, Trading, etc.)
- Questions that return both documents and nodes
- Questions that return only one type of source

### Recommended Test Queries
```
1. "What are the risk management systems?" (likely to return nodes)
2. "Tell me about trading procedures" (likely to return docs + nodes)  
3. "How does the analytics engine work?" (likely to return nodes)
4. "Show me documentation about compliance" (likely to return only docs)
```

## Sign-off Criteria

### QA Approval Checklist
- [ ] All core functionality tests pass
- [ ] No accessibility violations found
- [ ] Performance is acceptable across browsers
- [ ] Mobile experience is usable
- [ ] Error handling works gracefully
- [ ] Documentation is complete and accurate

### Deployment Readiness
- [ ] Code review completed
- [ ] Unit tests pass (coverage >90%)
- [ ] Integration tests pass
- [ ] Accessibility tests pass
- [ ] Manual QA sign-off obtained
- [ ] Performance benchmarks met

---

**QA Completed By**: [Name]  
**Date**: [Date]  
**Version**: 1.0  
**Status**: [Pass/Fail/Pending] 