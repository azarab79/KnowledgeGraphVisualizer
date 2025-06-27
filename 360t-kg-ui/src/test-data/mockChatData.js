/**
 * Mock chat data for testing MessageReferences integration
 */

export const mockSourceDocuments = [
  {
    id: 'doc1',
    title: 'Financial Report Q3 2024',
    preview: 'This document contains the quarterly financial report for Q3 2024...',
    full_text: 'Financial Report Q3 2024\n\nRevenue has increased by 15% compared to the previous quarter. The main drivers were:\n- Increased sales in the European market\n- New product launches\n- Cost optimization initiatives\n\nNet profit margin improved to 12.5% from 11.2% in Q2.',
    metadata: {
      title: 'Financial Report Q3 2024',
      source: 'finance_dept',
      date: '2024-10-15'
    }
  },
  {
    id: 'doc2',
    title: 'User Manual - Trading System v2.1',
    preview: 'Comprehensive guide for using the new trading system interface...',
    full_text: 'User Manual - Trading System v2.1\n\nThis manual provides step-by-step instructions for:\n1. Logging into the system\n2. Navigating the main dashboard\n3. Placing orders\n4. Managing your portfolio\n5. Generating reports\n\nFor technical support, contact the help desk at ext. 1234.',
    metadata: {
      title: 'User Manual - Trading System v2.1',
      source: 'tech_docs',
      version: '2.1'
    }
  },
  {
    id: 'doc3',
    title: 'Risk Management Guidelines',
    preview: 'Important guidelines for managing trading risks and compliance...',
    full_text: 'Risk Management Guidelines\n\nAll traders must adhere to the following risk limits:\n- Maximum position size: 10% of portfolio\n- Daily loss limit: 2% of capital\n- Concentration limits by sector\n\nRegular risk assessments are required monthly.',
    metadata: {
      title: 'Risk Management Guidelines',
      source: 'risk_dept',
      category: 'compliance'
    }
  }
];

export const mockSourceNodes = [
  {
    id: 'user_123',
    name: 'John Smith',
    labels: ['User', 'Trader']
  },
  {
    id: 'system_ems',
    name: 'Execution Management System',
    labels: ['System', 'Trading']
  },
  {
    id: 'dashboard_fs',
    name: 'FS Dashboard',
    labels: ['Interface', 'Dashboard', 'UI']
  },
  {
    id: 'db_trades',
    name: 'Trading Database',
    labels: ['Database', 'Storage']
  },
  {
    id: 'proc_settlement',
    name: 'Settlement Process',
    labels: ['Process', 'Workflow', 'Finance']
  },
  {
    id: 'risk_engine',
    name: 'Risk Management Engine',
    labels: ['System', 'Risk', 'Monitoring']
  },
  {
    id: 'order_book',
    name: 'Order Book Manager',
    labels: ['System', 'Trading', 'Orders']
  },
  {
    id: 'market_data',
    name: 'Market Data Feed',
    labels: ['Service', 'Data', 'Market']
  }
];

export const mockChatMessages = [
  {
    role: 'user',
    content: 'What are the key components of our trading system?',
    timestamp: '2024-01-20T10:00:00.000Z'
  },
  {
    role: 'assistant',
    content: 'Based on the knowledge graph, our trading system consists of several key components:\n\n## Core Systems\n- **Execution Management System (EMS)** - Handles order routing and execution\n- **FS Dashboard** - Main user interface for traders\n- **Trading Database** - Stores all transaction data\n\n## Key Processes\n- **Settlement Process** - Manages trade settlement and clearing\n- **Risk Management** - Monitors and controls trading risks\n\n## User Access\n- **Trader Accounts** - Individual user profiles with specific permissions\n\nThese components work together to provide a comprehensive trading environment with proper risk controls and reporting capabilities.',
    timestamp: '2024-01-20T10:00:15.000Z',
    sourceDocuments: mockSourceDocuments.slice(0, 2), // First 2 documents
    sourceNodes: mockSourceNodes // All nodes
  },
  {
    role: 'user',
    content: 'What are the current risk limits for traders?',
    timestamp: '2024-01-20T10:01:00.000Z'
  },
  {
    role: 'assistant',
    content: 'According to the risk management guidelines, traders must adhere to the following limits:\n\n## Position Limits\n- **Maximum position size**: 10% of portfolio value\n- **Daily loss limit**: 2% of total capital\n- **Sector concentration limits** apply to prevent overexposure\n\n## Monitoring Requirements\n- Monthly risk assessments are mandatory\n- Real-time monitoring through the FS Dashboard\n- Automatic alerts when approaching limits\n\nThese limits are enforced by the Execution Management System to ensure compliance.',
    timestamp: '2024-01-20T10:01:10.000Z',
    sourceDocuments: [mockSourceDocuments[2]], // Risk management doc
    sourceNodes: mockSourceNodes.slice(0, 3) // First 3 nodes
  },
  {
    role: 'user',
    content: 'How has our financial performance been this quarter?',
    timestamp: '2024-01-20T10:02:00.000Z'
  },
  {
    role: 'assistant',
    content: 'Our Q3 2024 financial performance has been strong:\n\n## Key Metrics\n- **Revenue growth**: 15% increase compared to Q2\n- **Net profit margin**: Improved to 12.5% (up from 11.2% in Q2)\n\n## Growth Drivers\n1. **European market expansion** - Significant sales increase\n2. **New product launches** - Successfully introduced new offerings\n3. **Cost optimization** - Streamlined operations for better efficiency\n\nThis performance demonstrates the effectiveness of our strategic initiatives and market positioning.',
    timestamp: '2024-01-20T10:02:08.000Z',
    sourceDocuments: [mockSourceDocuments[0]], // Financial report
    sourceNodes: [] // No nodes for this response
  }
];

export const mockEmptyMessage = {
  role: 'assistant',
  content: 'I don\'t have specific information about that topic in the knowledge graph.',
  timestamp: '2024-01-20T10:03:00.000Z',
  sourceDocuments: [],
  sourceNodes: []
}; 