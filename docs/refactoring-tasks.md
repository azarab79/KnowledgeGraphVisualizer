# PRD – Chat Context Refactor  
_Date:_ 20 Jun 2025  

---

## 1 • Problem  
- Chat logic split between `App.jsx` and `ChatView.jsx`.  
- Obsolete hook (`getConversationHistory`) crashes UI.  
- File writes in `data/chat_history` trigger `nodemon` restarts.

## 2 • Success Criteria  
- [ ] All chat state lives in a dedicated context.  
- [ ] UI loads without the history error.  
- [ ] Nodemon no longer restarts on chat save.  
- [ ] `?chatId=` deep-link works.  
- [ ] Tests updated & green.

## 3 • High-Level Solution  
Create `ChatContext` (context + reducer) → wrap app → refactor `ChatView` → ignore history folder in nodemon.

## 4 • Implementation Checklist  

### Phase 0 – Setup  
- [x] Branch `feat/chat-context-refactor`.  
- [x] Ensure baseline tests pass.

### Phase 1 – Context  
- [x] `src/contexts/ChatContext.jsx` with reducer, selectors, debounced autosave.  
- [x] Guard initial fetch against React-18 double mount.  

### Phase 2 – Provider wiring  
- [ ] Wrap `<ChatProvider>` around tree in `main.jsx`.

### Phase 3 – ChatView refactor  
- [ ] Remove local state, use `useChatState / useChatActions`.  
- [ ] Delete obsolete Save button; hook buttons to context actions.

### Phase 4 – App.jsx cleanup  
- [ ] Remove old chat hooks, state, and history `useEffect`.  
- [ ] Navigation: call `loadConversations()` then `setCurrentView('chat')`.  
- [ ] Render `<ChatView />` only when Chat tab active.  
- [ ] URL push / restore logic synced with context.

### Phase 5 – Nodemon stability  
- [ ] Add `360t-kg-api/nodemon.json` with `"ignore": ["data/**/*"]`.

### Phase 6 – Tests & Utils  
- [ ] Create `tests/utils/renderWithProviders.js`.  
- [ ] Update existing tests to wrap in `ChatProvider`.  
- [ ] Add reducer unit tests.

### Phase 7 – Manual QA  
- [ ] Send rapid messages → no server restart.  
- [ ] Dropdown name updates after first user message.  
- [ ] Refresh with `?chatId=` restores conversation.  
- [ ] Explorer/Analysis still function.

### Phase 8 – Merge & Cleanup  
- [ ] PR review approved.  
- [ ] Squash-merge to `main`, delete feature branch.

## 5 • Risks / Mitigations  
- Excess re-renders → use selector pattern.  
- Double API in StrictMode → init guard.  
- Autosave flood → debounce 1.2 s.  
- Deep-link race → wait for `conversationsLoaded`.  

- Browser-history spam (every chat switch pushes)  
  → use `history.replaceState` for internal tab switches; pushState only on first open.  

- Memory bloat from very long histories  
  → cap in-memory history to N messages; lazy-load older messages on scroll.  

- Autosave failure loop (backend 500)  
  → stop after 3 consecutive failures and surface toast; log to console.  

- Dev seed-script edits ignored by nodemon  
  → document that editing `data/**` requires manual restart or provide a separate `npm run seed` script.  

- Accessibility regression (Save button removed)  
  → verify keyboard tab order & add `aria-live` region to announce "chat autosaved".  

- Analytics gap (Save-click metric lost)  
  → emit `chat_autosave_success` event after debounce completes.

## 6 • Rollback  
If issues: `git revert <merge-commit>` + reinstall old `package.json`, restart servers.

