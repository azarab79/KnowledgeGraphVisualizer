# 🛡️ Demo Protection Strategy

## ⚠️ CRITICAL: Demo Tomorrow - Zero Risk Approach

### 1. IMMEDIATE BACKUP (Do This First!)

```bash
# Create complete backup
cp -r . ../KnowledgeGraphVisualizer-DEMO-BACKUP

# Create git tag for current state
git add .
git commit -m "Pre-demo stable state backup"
git tag demo-stable-$(date +%Y%m%d-%H%M)
git push origin demo-stable-$(date +%Y%m%d-%H%M)
```

### 2. Feature Flag Protection

Add to `360t-kg-api/.env`:
```env
# CRITICAL: Feature flag for demo safety
ENABLE_CHAT_FEATURE=false

# Chat Feature Dependencies (only used if ENABLE_CHAT_FEATURE=true)
OLLAMA_BASE_URL=http://localhost:11434
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
FASTAPI_SERVICE_URL=http://localhost:8000
```

### 3. Development Rules (IF You Must Develop)

#### Backend Protection (360t-kg-api/)
- ✅ Create NEW files only: `routes/chat.js`, `services/chatService.js`
- ❌ NEVER modify existing files: `server.js`, `routes/graph.js`
- ✅ Wrap all new routes with feature flag:

```javascript
// routes/chat.js
const express = require('express');
const router = express.Router();

// Feature flag protection
if (process.env.ENABLE_CHAT_FEATURE !== 'true') {
  router.use((req, res) => {
    res.status(404).json({ error: 'Chat feature not enabled' });
  });
  module.exports = router;
  return;
}

// Chat implementation here...
```

#### Frontend Protection (360t-kg-ui/)
- ✅ Create NEW components only: `components/Chat/`, `services/chatService.js`
- ❌ NEVER modify existing components: `GraphView.jsx`, `Header.jsx`
- ✅ Conditional rendering with feature flag:

```jsx
// In App.jsx - ADD ONLY, don't modify existing
import { useState, useEffect } from 'react';

function App() {
  const [chatEnabled, setChatEnabled] = useState(false);
  
  useEffect(() => {
    // Check if chat feature is enabled
    fetch('/api/feature-flags')
      .then(res => res.json())
      .then(data => setChatEnabled(data.chatEnabled))
      .catch(() => setChatEnabled(false));
  }, []);

  return (
    <div>
      {/* Existing components - DON'T TOUCH */}
      <Header />
      <GraphView />
      
      {/* New chat feature - conditionally rendered */}
      {chatEnabled && <ChatComponent />}
    </div>
  );
}
```

### 4. Emergency Rollback Procedures

#### Option A: Disable Feature Flag
```bash
# In 360t-kg-api/.env
ENABLE_CHAT_FEATURE=false

# Restart server
npm restart
```

#### Option B: Git Rollback
```bash
# Rollback to stable state
git reset --hard demo-stable-$(date +%Y%m%d-%H%M)

# Or restore from backup
rm -rf ./*
cp -r ../KnowledgeGraphVisualizer-DEMO-BACKUP/* .
```

### 5. Pre-Demo Validation Checklist

Run this validation script before your demo:

```bash
# Test existing functionality
node scripts/validate-demo.js
```

### 6. Demo Day Protocol

1. **2 hours before demo**: Run full validation
2. **1 hour before demo**: Set `ENABLE_CHAT_FEATURE=false`
3. **30 minutes before demo**: Test all existing features
4. **During demo**: Only show existing features unless Chat is 100% stable

## 🚨 RECOMMENDATION

**For a demo tomorrow, I strongly recommend Option 1: Don't develop new features.**

Instead:
1. Stabilize existing functionality
2. Create a simple mockup/wireframe of the Chat feature
3. Focus on a flawless demo of existing features
4. Implement Chat feature AFTER the demo

## Risk Assessment

- **Developing new features with demo tomorrow**: 🔴 HIGH RISK
- **Using feature flags with isolation**: 🟡 MEDIUM RISK  
- **No development until after demo**: 🟢 ZERO RISK

Choose based on how critical this demo is to your success. 