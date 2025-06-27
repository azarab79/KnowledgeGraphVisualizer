# PRD – Expose "Source Nodes" in Chat Responses  
_Date:_ 20 Jun 2025  

---

## 1 • Problem  
LLM answers already know which graph nodes and documents they used, but the chat UI does not show them.  
Users cannot drill-down or toggle this context.

## 2 • Success Criteria  
- [ ] Python returns a structured `source_nodes` array.  
- [ ] Express propagates `sourceNodes`.  
- [ ] Chat history items include `sourceNodes`.  
- [ ] **Unified tabbed interface** under assistant messages shows either docs or nodes.  
- [ ] Node chips display node ID as readable text.  
- [ ] Message layout remains clean & responsive.  
- [ ] All tests green.

## 3 • High-Level Solution  
"Solution A – Tabbed References + Hover Details"  
1. Backend: add `source_nodes`.  
2. UI: single **tabbed reference area** per message (docs | nodes | all).  
3. Progressive disclosure: only active tab content visible.  
4. Clean styling with proper spacing.

## 4 • Implementation Checklist  

### Phase 0 – Setup  
- [ ] Branch `feat/chat-source-nodes`.  
- [ ] Baseline tests green.

### Phase 1 – Backend Data  
- [ ] **Python** `real_llm_kg_script.py`  
  - [ ] Collect `id,name,labels` → `source_nodes` (≤15).  
  - [ ] Ensure consistent shape: `{id: string, name: string, labels: string[]}`  
  - [ ] Add error boundary for malformed Cypher results.  
  - [ ] Unit test with mock Neo4j responses.  
- [ ] **Node** `chatRoutes.js`  
  - [ ] Map `result.source_nodes` ➜ `responseMessage.sourceNodes`.  
  - [ ] Validate array structure before sending.  
  - [ ] Update Swagger schema with `sourceNodes` field.  
  - [ ] Integration test: POST returns valid array structure.

### Phase 2 – Context State & TypeScript  
- [ ] **Type Definitions** (`types/chat.ts` or inline)  
  ```typescript
  interface SourceNode {
    id: string;
    name: string;
    labels: string[];
  }
  interface ChatMessage {
    // existing fields...
    sourceNodes?: SourceNode[];
    sourceDocuments?: SourceDocument[];
  }
  ```
- [ ] **ChatContext Updates**  
  - [ ] Extend reducer to handle `sourceNodes` in ADD_MESSAGE.  
  - [ ] Ensure autosave includes new field in conversation persistence.  
  - [ ] Add selector: `getMessageReferences(messageIndex)`.  
  - [ ] Reducer tests with new message shape.

### Phase 3 – Component Architecture  
- [ ] **MessageReferences.jsx** (new, replaces DocumentReferences)  
  ```jsx
  // Props interface
  interface MessageReferencesProps {
    sourceDocuments: SourceDocument[];
    sourceNodes: SourceNode[];
    messageRole: 'user' | 'assistant';
    onNodeSelect: (nodeId: string) => void;
  }
  
  // Component structure
  const MessageReferences = ({ sourceDocuments, sourceNodes, messageRole, onNodeSelect }) => {
    const [activeTab, setActiveTab] = useState('sources'); // 'sources' | 'nodes' | 'all'
    const hasDocuments = sourceDocuments?.length > 0;
    const hasNodes = sourceNodes?.length > 0;
    
    // Hide entirely if no references
    if (messageRole !== 'assistant' || (!hasDocuments && !hasNodes)) {
      return null;
    }
    
    return (
      <div className="message-references">
        <TabHeader />
        <TabContent />
      </div>
    );
  };
  ```
- [ ] **Tab State Management**  
  - [ ] Use `useState` for active tab (no global state needed).  
  - [ ] Smart default: show 'sources' if available, else 'nodes'.  
  - [ ] Memoize tab content to prevent unnecessary re-renders.

### Phase 4 – Subcomponents  
- [ ] **TabHeader.jsx**  
  ```jsx
  const TabHeader = ({ activeTab, onTabChange, documentCount, nodeCount }) => (
    <div className="tab-header" role="tablist" aria-label="Message references">
      {documentCount > 0 && (
        <button 
          role="tab" 
          aria-selected={activeTab === 'sources'}
          aria-controls="sources-panel"
          onClick={() => onTabChange('sources')}
        >
          📄 Sources {documentCount}
        </button>
      )}
      {nodeCount > 0 && (
        <button 
          role="tab" 
          aria-selected={activeTab === 'nodes'}
          aria-controls="nodes-panel"
        >
          🌐 Nodes {nodeCount}
        </button>
      )}
      {documentCount > 0 && nodeCount > 0 && (
        <button 
          role="tab" 
          aria-selected={activeTab === 'all'}
          aria-controls="all-panel"
        >
          All {documentCount + nodeCount}
        </button>
      )}
    </div>
  );
  ```
- [ ] **TabContent.jsx**  
  ```jsx
  const TabContent = ({ activeTab, sourceDocuments, sourceNodes, onNodeSelect }) => {
    const renderContent = () => {
      switch (activeTab) {
        case 'sources':
          return sourceDocuments.map((doc, idx) => 
            <DocumentIcon key={doc.id || idx} document={doc} index={idx} />
          );
        case 'nodes':
          return sourceNodes.map((node, idx) => 
            <NodeChip key={node.id} node={node} onSelect={onNodeSelect} />
          );
        case 'all':
          return [
            ...sourceDocuments.map((doc, idx) => 
              <DocumentIcon key={`doc-${doc.id || idx}`} document={doc} index={idx} />
            ),
            ...sourceNodes.map((node, idx) => 
              <NodeChip key={`node-${node.id}`} node={node} onSelect={onNodeSelect} />
            )
          ];
        default:
          return <div className="empty-state">No references found</div>;
      }
    };
    
    return (
      <div 
        className="tab-content" 
        role="tabpanel" 
        aria-labelledby={`${activeTab}-tab`}
        id={`${activeTab}-panel`}
      >
        {renderContent()}
      </div>
    );
  };
  ```

### Phase 5 – NodeChip Component  
- [ ] **NodeChip.jsx**  
  ```jsx
  const NodeChip = ({ node, onSelect }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const iconSrc = getNodeIcon(node); // Reuse from NodeDetails
    
    const handleClick = useCallback(() => {
      onSelect(node.id);
    }, [node.id, onSelect]);
    
    const handleKeyPress = useCallback((e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    }, [handleClick]);
    
    return (
      <div 
        className="node-chip"
        onClick={handleClick}
        onKeyPress={handleKeyPress}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        tabIndex={0}
        role="button"
        aria-label={`View details for ${node.name || node.id}`}
      >
        <img src={`/svg/${iconSrc}`} alt="" className="node-icon" />
        <span className="node-id">{node.id}</span>
        
        {showTooltip && (
          <Tooltip>
            <div className="tooltip-title">{node.name || node.id}</div>
            {node.labels?.length > 0 && (
              <div className="tooltip-labels">
                {node.labels.join(', ')}
              </div>
            )}
          </Tooltip>
        )}
      </div>
    );
  };
  ```

### Phase 6 – Integration Points  
- [ ] **ChatView.jsx Updates**  
  ```jsx
  // Replace DocumentReferences with MessageReferences
  <MessageReferences 
    sourceDocuments={message.sourceDocuments || []}
    sourceNodes={message.sourceNodes || []}
    messageRole={message.role}
    onNodeSelect={actions.selectNode}
  />
  ```
- [ ] **Context Actions**  
  ```jsx
  // In ChatContext
  const selectNode = useCallback(async (nodeId) => {
    try {
      setSelectedNode({ id: nodeId, loading: true });
      const details = await getNodeDetails(nodeId);
      setSelectedNode({ ...details, loading: false });
      setShowNodeModal(true);
    } catch (error) {
      setSelectedNode({ id: nodeId, error: error.message, loading: false });
    }
  }, []);
  ```

### Phase 7 – CSS Architecture  
- [ ] **Styling Structure**  
  ```scss
  // src/styles/MessageReferences.scss
  .message-references {
    margin-top: 8px;
    border-top: 1px solid var(--border-light);
    
    .tab-header {
      display: flex;
      gap: 4px;
      padding: 8px 0 4px;
      
      button {
        padding: 4px 8px;
        border: 1px solid transparent;
        border-radius: 4px;
        background: transparent;
        font-size: 12px;
        cursor: pointer;
        
        &[aria-selected="true"] {
          background: var(--primary-light);
          border-color: var(--primary);
        }
        
        &:hover:not([aria-selected="true"]) {
          background: var(--hover-light);
        }
      }
    }
    
    .tab-content {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 0;
      min-height: 40px;
    }
  }
  
  .node-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    min-width: 60px;
    max-width: 80px;
    
    &:hover {
      background: var(--hover-light);
      border-color: var(--primary);
    }
    
    &:focus {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
    
    .node-icon {
      width: 20px;
      height: 20px;
      margin-bottom: 4px;
    }
    
    .node-id {
      font-size: 10px;
      font-family: monospace;
      text-align: center;
      line-height: 1.2;
      word-break: break-all;
      color: var(--text-secondary);
    }
  }
  ```

### Phase 8 – Performance Optimizations  
- [ ] **Memoization Strategy**  
  ```jsx
  const MessageReferences = React.memo(({ sourceDocuments, sourceNodes, messageRole, onNodeSelect }) => {
    // Component implementation
  }, (prevProps, nextProps) => {
    return (
      prevProps.messageRole === nextProps.messageRole &&
      arraysEqual(prevProps.sourceDocuments, nextProps.sourceDocuments) &&
      arraysEqual(prevProps.sourceNodes, nextProps.sourceNodes)
    );
  });
  
  const NodeChip = React.memo(({ node, onSelect }) => {
    // Component implementation
  });
  ```
- [ ] **Lazy Icon Loading**  
  ```jsx
  const LazyNodeIcon = ({ iconSrc, alt }) => {
    const [loaded, setLoaded] = useState(false);
    return (
      <img 
        src={`/svg/${iconSrc}`} 
        alt={alt}
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0.5 }}
      />
    );
  };
  ```

### Phase 9 – Error Boundaries & Loading States  
- [ ] **Error Handling**  
  ```jsx
  const MessageReferences = ({ sourceDocuments, sourceNodes, ...props }) => {
    // Defensive programming
    const safeDocuments = Array.isArray(sourceDocuments) ? sourceDocuments : [];
    const safeNodes = Array.isArray(sourceNodes) ? sourceNodes : [];
    
    try {
      return <MessageReferencesInner documents={safeDocuments} nodes={safeNodes} {...props} />;
    } catch (error) {
      console.error('MessageReferences render error:', error);
      return <div className="references-error">Unable to load references</div>;
    }
  };
  ```

### Phase 10 – Testing Strategy  
- [ ] **Unit Tests** (Jest + RTL)  
  ```jsx
  describe('MessageReferences', () => {
    it('shows sources tab when documents available', () => {
      render(
        <MessageReferences 
          sourceDocuments={[mockDoc]} 
          sourceNodes={[]} 
          messageRole="assistant"
          onNodeSelect={jest.fn()}
        />
      );
      expect(screen.getByRole('tab', { name: /sources/i })).toBeInTheDocument();
    });
    
    it('switches tabs on click', () => {
      // Test implementation
    });
    
    it('calls onNodeSelect when node chip clicked', () => {
      // Test implementation
    });
  });
  ```
- [ ] **Integration Tests** (Cypress)  
  ```javascript
  it('displays node references in chat message', () => {
    cy.visit('/chat');
    cy.get('[data-testid="chat-input"]').type('show me risk reversal{enter}');
    cy.get('.message.assistant').should('contain', 'risk reversal');
    cy.get('.tab-header button').contains('Nodes').click();
    cy.get('.node-chip').should('have.length.at.least', 1);
    cy.get('.node-chip').first().click();
    cy.get('.node-details-modal').should('be.visible');
  });
  ```

### Phase 11 – Accessibility Compliance  
- [ ] **WCAG 2.1 AA Requirements**  
  - [ ] Color contrast ≥4.5:1 for text, ≥3:1 for UI elements.  
  - [ ] Keyboard navigation: Tab → through chips, Enter/Space to activate.  
  - [ ] Screen reader: proper ARIA labels, roles, and live regions.  
  - [ ] Focus management: clear focus indicators, logical tab order.  
- [ ] **Testing Tools**  
  - [ ] axe-core automated testing.  

### Phase 12 – Manual QA & Edge Cases  
- [ ] **Content Variations**  
  - [ ] Empty arrays: no tabs shown.  
  - [ ] Only docs: single tab, no switching.  
  - [ ] Only nodes: single tab.  
  - [ ] Large counts: "Sources 99+" truncation.  
- [ ] **Responsive Behavior**  
  - [ ] Mobile (320px): tabs stack, chips wrap.  
  - [ ] Tablet (768px): horizontal layout maintained.  
  - [ ] Desktop (1024px+): optimal spacing.  
- [ ] **Performance Benchmarks**  
  - [ ] 50 messages with 10 refs each: < 2s render.  
  - [ ] Tab switching: < 100ms response.  
  - [ ] Memory usage: no leaks over 100 interactions.

### Phase 13 – Merge & Cleanup  
- [ ] **Code Review Checklist**  
  - [ ] TypeScript types properly defined.  
  - [ ] No console.log statements in production code.  
  - [ ] CSS follows design system conventions.  
  - [ ] PropTypes or TypeScript props validated.  
  - [ ] Tests achieve ≥80% coverage.  
- [ ] **Documentation Updates**  
  - [ ] Component JSDoc comments.  
  - [ ] README architecture section.  
  - [ ] Storybook entries for new components.  
- [ ] **Deployment**  
  - [ ] PR approved by 2+ reviewers.  
  - [ ] Staging deployment successful.  
  - [ ] Feature flag enabled for gradual rollout.  
  - [ ] Squash-merge, delete feature branch.

## 5 • Side-Effects & Mitigations  

| Issue | Impact | Technical Mitigation |
|-------|--------|---------------------|
| **Bundle size increase** | Slower initial load | Tree-shake unused icons; lazy load tab content |
| **Memory leaks from event listeners** | Performance degradation | useEffect cleanup; WeakMap for tooltip refs |
| **Hydration mismatches** | SSR errors | Consistent defaultProps; isomorphic icon paths |
| **Race conditions in node selection** | Duplicate API calls | Debounce clicks; cancel in-flight requests |
| **CSS specificity conflicts** | Styling breaks | CSS modules or styled-components; scoped classes |
| **Tab focus traps** | Accessibility issues | Proper ARIA relationships; roving tabindex |

## 6 • Rollback Strategy  
```bash
# Emergency rollback
git revert <merge-commit-hash>

# Partial rollback (keep backend, remove UI)
git checkout HEAD~1 -- src/components/MessageReferences.jsx
git checkout HEAD~1 -- src/components/NodeChip.jsx
git commit -m "Remove UI components, keep backend changes"

# Feature flag disable
// In MessageReferences.jsx
const ENABLE_NODE_REFERENCES = process.env.REACT_APP_ENABLE_NODE_REFS === 'true';
if (!ENABLE_NODE_REFERENCES) return <DocumentReferences {...props} />;
```

---  
*Lead Architect:* React & HTML Specialist  
*Review Status:* ✅ Architecture approved, ready for implementation sprint.