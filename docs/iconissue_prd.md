# Icon Mapping – PRD / Checklist
this was the original plan to be updated: Below is a concrete implementation plan for Proposal 1 (“Single Source-of-Truth mapping file”).  
Treat each bullet as a discrete task you can check off in Jira / Task-Master.

--------------------------------------------------------------------
Phase A – Preparation
--------------------------------------------------------------------
☐ A-1 Catalogue existing SVGs  
 • Run `ls public/svg | sort` and paste result in the ticket for reference.

☐ A-2 Identify the ten node labels that **must** be covered (e.g. System, Database, …).  
 • Confirm with product / UX that there are exactly ten.

--------------------------------------------------------------------
Phase B – Code changes
--------------------------------------------------------------------
☐ B-1 Create `src/constants/iconMap.js`  
```js
export const ICON_MAP = {
  System:  'system-svgrepo-com.svg',
  Database:'database-svgrepo-com.svg',
  Storage: 'database-svgrepo-com.svg',
  Trading: 'finance-department-trader-trading-cfo-svgrepo-com.svg',
  Finance: 'finance-svgrepo-com.svg',
  User:    'user-alt-1-svgrepo-com.svg',
  Trader:  'user-alt-1-svgrepo-com.svg',
  Process: 'workflow-svgrepo-com.svg',
  Workflow:'workflow-svgrepo-com.svg',
  Dashboard:'business-connection-connect-communication-teamwork-people-svgrepo-com.svg'
};
export const DEFAULT_ICON = 'system-svgrepo-com.svg';

export const getNodeIcon = label =>
  ICON_MAP[label] || DEFAULT_ICON;
```

☐ B-2 Refactor `NodeChip.jsx`  
 • `import { getNodeIcon }` instead of local map.  
 • Pass `label` (or first label in `node.labels`) to helper.

☐ B-3 Refactor `NodeDetails.jsx`  
 • Same import / usage; delete any duplicated icon logic.

☐ B-4 Delete old inline `getNodeIcon` functions so there is **one** source.

--------------------------------------------------------------------
Phase C – Safety net (build-time guard)
--------------------------------------------------------------------
☐ C-1 Add script `scripts/check-icons.js`  
 • Reads `ICON_MAP` and fails if the referenced file is missing in `public/svg/`.  
 • Warns if an SVG exists that is not mapped (optional).

☐ C-2 Wire script into `npm test` or `npm run lint`  
```json
"scripts": {
  "icon-check": "node scripts/check-icons.js",
  "lint":       "npm run icon-check && eslint src"
}
```

--------------------------------------------------------------------
Phase D – Automated tests
--------------------------------------------------------------------
☐ D-1 Unit test for helper  
 • `expect(getNodeIcon('System')).toBe('system-svgrepo-com.svg')`  
 • `expect(getNodeIcon('UnknownLabel')).toBe(DEFAULT_ICON)`

☐ D-2 Integration test (Testing-Library)  
  1. Render `MessageReferences` with 10 mock nodes (one per label).  
  2. `expect(screen.getAllByRole('img')).toHaveLength(10)`  
  3. Click one chip → assert `NodeDetails` shows the same `name` and `labels[0]`.

--------------------------------------------------------------------
Phase E – Manual verification
--------------------------------------------------------------------
☐ E-1 Start dev environment (`npm run dev`) – fix the `EADDRINUSE` clash first (`lsof -i :3002` then kill or change `PORT`).  
☐ E-2 Open `http://localhost:5177` (or Vite’s port).  
 • Confirm 10 icons render, no 404s in Network tab.  
 • Click each icon → NodeDetails panel opens with correct data.

--------------------------------------------------------------------
Phase F – Documentation & cleanup
--------------------------------------------------------------------
☐ F-1 Add a short section to `docs/ARCHITECTURE.md` (or README) explaining the icon-mapping contract and the check-icons script.  
☐ F-2 Commit & push; create PR with description referencing this checklist.  
☐ F-3 Merge after CI passes.

--------------------------------------------------------------------
Completion criteria
--------------------------------------------------------------------
1. CI fails if an icon mapping or SVG file is missing.  
2. Jest integration test proves “10 icons + open details” flow.  
3. Manual QA shows no missing icons and correct details panel.
> Governs the single-source icon mapping created in **Proposal 1**

---
## 1  Human-Upkeep Rules

- [ ] **Colocation** SVG files and `src/constants/iconMap.js` live in the *same* `/public/svg` (icons) folder subtree so reviewers see changes side-by-side.
- [ ] **DoD update** Definition-of-Done requires:
  - adding new label ➜ update `iconMap.js`
  - ensure corresponding SVG committed
  - run `npm run icon-check` locally before pushing.
- [ ] **PR template** contains a checkbox:
  ```
  ☐  Added / updated icon mapping + SVG where required
  ```
- [ ] **CI** runs `npm run icon-check` early; failure blocks merge.

---
## 2  Scalability & i18n

- [ ] **Canonical label** All calls use domain label (e.g. `Product`) not UI-translated text.
- [ ] **Helper API** `getNodeIcon(label, { fallback = DEFAULT_ICON, hardFail = false })` centralises fallback policy.
- [ ] **Policy decision**
  - Hard-fail (`CI red`) if unknown label ☐
  - Soft-fallback with default icon ☐
  (tick one – stay consistent.)
- [ ] **Future >30 icons** Re-evaluate: possible migration to sprite sheet or dynamic backend icons.

---
## 3  Regression Tests

- [ ] `iconMap.test.js` validates helper returns existing file.
- [ ] `check-icons.js` script verifies map ⇄ file system consistency.
- [ ] Integration test renders 10 chips → asserts `<img src>` matches mapping.

---
## 4  Ownership & Contacts

- **FE Guild** owns `iconMap.js`.
- **Design** provides any new SVGs adhering to 24×24 viewBox.

---
## 5  Open Questions

- Do we store SVGs in mono-repo or CDN bucket?  
- Who approves visual style for fallback icon? 