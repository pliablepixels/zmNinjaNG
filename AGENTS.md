# Development Guidelines

## Quick Reference
1. **NO SUPERLATIVES**: Never use "comprehensive", "critical", "major", "robust", "powerful", etc. Plain, factual language only.
2. **Issues First**: Create GitHub issue before implementing features or fixing bugs
3. **Testing**: Write tests first, run and verify pass before commit
4. **Documentation**: Update `docs/developer-guide/` when adding new APIs, components, or utilities
5. **Internationalization**: Update ALL language files (en, de, es, fr, zh)
6. **Cross-platform**: iOS, Android, Desktop, mobile portrait + landscape
7. **Settings**: Profile-scoped only; read/write via `getProfileSettings`/`updateProfileSettings`
8. **Bandwidth**: Polling/refresh features need bandwidth settings support (normal vs. low)
9. **Logging**: Use `log.*` component helpers with explicit LogLevel, never `console.*`
10. **HTTP**: Use `lib/http.ts` abstractions (`httpGet`, `httpPost`, etc.), never raw `fetch()` or `axios`
11. **Text Overflow**: Use `truncate` + `min-w-0` in flex containers; add `title` for tooltips
12. **Coding**: DRY, small files (~400 LOC max), extract complex logic to separate modules
13. **Semantic Search**: Use grepai as primary tool for code exploration. See [grepai section](#grepai---semantic-code-search).

---

## Forbidden Actions

- **NEVER USE SUPERLATIVE LANGUAGE** - No "comprehensive", "critical", "major", "robust", "powerful", "extensively", "thoroughly", "excellent", "amazing", "significant", etc. in ANY communication (responses, commits, docs, comments). Use plain, factual descriptions.
- **Never use `console.*`** - use `log.*` component helpers with explicit LogLevel
- **Never use raw `fetch()` or `axios`** - use `app/src/lib/http.ts` abstractions
- **Never convert to Blob on mobile** - use CapacitorHttp base64 directly
- **Never commit without running tests** - unit tests AND e2e tests must pass
- **Never use static imports for Capacitor plugins** - use dynamic imports with platform checks
- **Never claim "build passed" as proof code works** - build only checks types, not behavior
- **Never leave features half-implemented** - complete fully or don't start
- **Never merge to main without user approval** - always request review first
- **Never hardcode user-facing strings** - all text must use i18n
- **Never skip `data-testid` on interactive elements** - required for e2e tests
- **Never implement features/fixes without a GitHub issue** - create issue first, reference in commits
- **Never add new APIs/components without updating docs** - update developer-guide in same session
- **Never update Tauri JS or Rust packages independently** - JS `@tauri-apps/*` and Rust `tauri-plugin-*` versions must match. Update both `package.json` and `Cargo.toml` together.
- **Never check in plan files** - Plans (`.md` files used during feature planning) must not be committed to the repository. Delete plan files once the feature is complete.

---

## Working Directory

All `npm` commands must be run from the `app/` directory.

```bash
cd app
```

Structure:
- `./` - workspace root (contains AGENTS.md, docs/, scripts/)
- `app/` - main application (run npm commands here)
- `app/src/` - source code
- `app/tests/` - e2e test features and helpers

---

## Testing

### Philosophy
Test everything like a human would. Every button, tap, and interaction must be tested as a real user would experience it.

**Do**:
- Click buttons and verify actions happen
- Fill forms and verify data is saved
- Test on mobile viewports (375x812)
- Test error states and edge cases

**Don't**:
- Mock the thing you're testing
- Only test that "component renders"
- Skip mobile viewport tests
- Write tests that pass but don't verify real behavior

### Test-First Workflow
1. Understand the bug/feature requirement
2. Write a failing test that reproduces the issue
3. Implement the fix/feature
4. Run tests - verify they pass
5. Run full test suite to check for regressions
6. Commit

### Unit Tests
**Location**: Next to source in `__tests__/` subdirectory
- Example: `app/src/lib/crypto.ts` → `app/src/lib/__tests__/crypto.test.ts`

**What to test**: Happy path, edge cases (empty/null/undefined), error cases, state changes

**Run**: `npm test`

### E2E Tests
**When required**: UI changes, navigation changes, interaction changes, new workflows

**Location**: `app/tests/features/*.feature` (Gherkin format, never .spec.ts directly)

**Run**: `npm run test:e2e -- <feature>.feature`

### Test Commands
```bash
npm test                              # Unit tests
npm test -- --coverage                # With coverage
npm run test:e2e                      # All e2e tests
npm run test:e2e -- <feature>.feature # Specific feature
npm run test:e2e -- --headed          # See browser
```

### E2E Test Configuration
Configure test server in `.env`:
```bash
ZM_HOST_1=http://your-server:port
ZM_USER_1=admin
ZM_PASSWORD_1=password
```

### Conditional Testing Pattern
For features depending on dynamic content:
```typescript
let actionPerformed = false;

When('I click download if exists', async ({ page }) => {
  const button = page.getByTestId('download-button');
  if (await button.isVisible({ timeout: 1000 })) {
    await button.click();
    actionPerformed = true;
  }
});

Then('I should see progress if started', async ({ page }) => {
  if (!actionPerformed) return;
  await expect(page.getByTestId('progress')).toBeVisible();
});
```

---

## Verification Workflow

For every code change, execute in order:

1. **Unit Tests**: `npm test` - must PASS
2. **Type Check**: `npx tsc --noEmit`
3. **Build**: `npm run build`
4. **E2E Tests** (if UI/navigation changed): `npm run test:e2e -- <feature>.feature`
5. **Commit** only after all tests pass

State which tests were run: "Tests verified: npm test ✓, npm run test:e2e -- dashboard.feature ✓"

### Pre-Commit Checklist

**All changes**:
- [ ] Tests written/updated
- [ ] `npm test` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds

**UI changes** (additional):
- [ ] `data-testid` added to new elements
- [ ] E2E tests updated in .feature file
- [ ] `npm run test:e2e -- <feature>.feature` passes
- [ ] Responsive reflow verified (mobile portrait)
- [ ] All language files updated

### Never commit if:
- Tests are failing
- Tests don't exist for new functionality
- You haven't actually run the tests
- You only ran build but not unit/e2e tests

---

## Internationalization

Every user-facing string must be internationalized.

- **Location**: `app/src/locales/{lang}/translation.json`
- **Languages**: en, de, es, fr, zh (update ALL)
- **Usage**:
  ```typescript
  const { t } = useTranslation();
  <Text>{t('setup.title')}</Text>
  toast.error(t('montage.screen_too_small'));
  ```
- **New language**: Follow `.agent/workflows/add_language.md`

---

## UI & Cross-Platform

### Platform Support
- Test on iOS, Android, Desktop
- Verify mobile portrait reflow before committing

### Data Tags
- **Format**: `data-testid="kebab-case-name"`
- **Add to**: All interactive elements and key containers
  ```tsx
  <button data-testid="add-profile-button">
  ```

### Text Overflow
- **Single-line**: `className="truncate"` + `title={text}`
- **Multi-line**: `className="line-clamp-2"`
- **In flex containers**: Add `min-w-0` with truncate
  ```tsx
  <div className="flex items-center gap-2">
    <span className="truncate min-w-0">{text}</span>
  </div>
  ```

---

## Logging

Never use `console.*` - use structured logging.

```typescript
import { log, LogLevel } from '../lib/logger';

// Component-specific helpers (preferred)
log.secureStorage('Value encrypted', LogLevel.DEBUG, { key });
log.profileForm('Testing connection', LogLevel.INFO, { portalUrl });
log.download('Failed to download', LogLevel.ERROR, { url }, error);
```

**Available helpers**: `log.notifications()`, `log.profileService()`, `log.push()`, `log.eventDetail()`, `log.monitorDetail()`, `log.profileForm()`, `log.monitorCard()`, `log.montageMonitor()`, `log.videoPlayer()`, `log.errorBoundary()`, `log.imageError()`, `log.download()`, `log.crypto()`, `log.http()`, `log.navigation()`, `log.secureStorage()`, `log.time()`, `log.discovery()`, `log.dashboard()`, `log.queryCache()`, `log.api()`, `log.auth()`, `log.profile()`, `log.monitor()`

---

## HTTP Requests

Use `lib/http.ts` abstractions - never `fetch()` or `axios` directly.

```typescript
import { httpGet, httpPost, httpPut, httpDelete } from '../lib/http';

const data = await httpGet<MonitorData>('/api/monitors.json');
await httpPost('/api/states/change.json', { monitorId: '1', newState: 'Alert' });
```

The abstraction automatically handles platform differences (Capacitor HTTP on mobile, fetch on web), logging, and authentication.

---

## Background Tasks & Downloads

Use background task store for long-running operations.

```typescript
const taskStore = useBackgroundTasks.getState();
const taskId = taskStore.addTask({
  type: 'download',
  metadata: { title: 'Video.mp4', description: 'Event 12345' },
  cancelFn: () => abortController.abort(),
});
taskStore.updateProgress(taskId, percentage, bytesProcessed);
taskStore.completeTask(taskId);
```

### Mobile Downloads - OOM Prevention
Never convert to Blob on mobile:

```typescript
// Mobile - CapacitorHttp returns base64 directly
const response = await CapacitorHttp.request({ method: 'GET', url, responseType: 'blob' });
const base64Data = response.data as string; // Already base64
await Filesystem.writeFile({ path: filename, data: base64Data, directory: Directory.Documents });
```

---

## Capacitor Native Features

### Dynamic Imports Required
```typescript
// Good - Dynamic import with platform check
if (Capacitor.isNativePlatform()) {
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Feature not available
  }
}

// Bad - Static import breaks on web
import { Haptics } from '@capacitor/haptics';
```

### Test Mocks
Add mocks to `app/src/tests/setup.ts`:
```typescript
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: vi.fn().mockResolvedValue(undefined) },
  ImpactStyle: { Heavy: 'Heavy', Medium: 'Medium', Light: 'Light' },
}));
```

### Version Compatibility
Match Capacitor plugin version with `@capacitor/core`:
```bash
npm list @capacitor/core
npm install @capacitor/haptics@7  # Match major version
```

### iOS/Android Native Code
- Capacitor regenerates some files - check before modifying
- Document custom native modifications
- Ensure changes won't be overwritten on regeneration

---

## Adding Dependencies

1. **Check compatibility**:
   ```bash
   npm info <package> peerDependencies
   npm list @capacitor/core  # For Capacitor plugins
   ```

2. **Install**: Match major versions for Capacitor plugins

3. **Tauri plugins**: JS `@tauri-apps/*` and Rust `tauri-plugin-*` must have matching versions. Update both `package.json` and `Cargo.toml` together.

4. **Update test mocks** if needed in `app/src/tests/setup.ts`

5. **Verify**: `npm test && npm run build`

---

## Settings & Data Management

### Profile-Scoped Settings
Settings must be stored under `ProfileSettings` via `getProfileSettings(currentProfile?.id)` and `updateProfileSettings(profileId, ...)`. Never use global singletons.

### Breaking Changes
Detect version/structure changes in stored data. If incompatible, prompt user to reset (don't crash).

---

## Bandwidth Settings

Features that poll or refresh data from the server must respect bandwidth settings to support users on low-bandwidth connections or mobile data.

### When to Use Bandwidth Settings

**Always use bandwidth settings for:**
- API polling intervals (useQuery `refetchInterval`)
- Auto-refresh timers for data fetching
- Background data sync operations
- Periodic status checks

**Examples requiring bandwidth settings:**
- Monitor status polling
- Event count refreshing
- Dashboard widget updates
- Timeline/heatmap data
- Daemon health checks
- Alarm status checking

### Implementation Pattern

```typescript
import { useBandwidthSettings } from '../hooks/useBandwidthSettings';

const bandwidth = useBandwidthSettings();

// Use in React Query
const { data } = useQuery({
  queryKey: ['monitors'],
  queryFn: getMonitors,
  refetchInterval: bandwidth.monitorStatusInterval, // Respects normal vs. low mode
});

// Use in timers
useEffect(() => {
  const interval = setInterval(() => {
    fetchData();
  }, bandwidth.eventsWidgetInterval);
  return () => clearInterval(interval);
}, [bandwidth.eventsWidgetInterval]);
```

### Available Bandwidth Properties

From `useBandwidthSettings()`:
- `monitorStatusInterval` - Monitor status updates
- `alarmStatusInterval` - Alarm state checking
- `consoleEventsInterval` - Event count refreshing
- `eventsWidgetInterval` - Dashboard events widget
- `timelineHeatmapInterval` - Timeline/heatmap data
- `daemonCheckInterval` - Server daemon health
- `snapshotRefreshInterval` - Snapshot image refresh
- `imageScale` - Image scaling percentage
- `imageQuality` - Image quality percentage
- `streamMaxFps` - Maximum stream FPS

### Adding New Bandwidth Properties

If adding a new polling/refresh feature:

1. **Add to BandwidthSettings type** in `lib/zmninja-ng-constants.ts`:
   ```typescript
   export interface BandwidthSettings {
     // ... existing properties
     myNewFeatureInterval: number; // Description
   }
   ```

2. **Add values for both modes**:
   ```typescript
   export const BANDWIDTH_SETTINGS: Record<BandwidthMode, BandwidthSettings> = {
     normal: {
       // ... existing settings
       myNewFeatureInterval: 30000, // 30 sec
     },
     low: {
       // ... existing settings
       myNewFeatureInterval: 60000, // 60 sec (2x slower for low bandwidth)
     },
   };
   ```

3. **Use in your component** via `useBandwidthSettings()`

### Quick Check

**Before implementing any feature that polls or auto-refreshes:**
- Does it fetch data from the server repeatedly?
- Does it run on a timer or interval?
- Could it consume significant bandwidth over time?

If yes to any → Use bandwidth settings!

---

## Documentation

### When to Update Developer Docs
Update `docs/developer-guide/` when adding:
- New API modules (`api/*.ts`) → Update `07-api-and-data-fetching.rst`
- New components (`components/*.tsx`) → Update `05-component-architecture.rst`
- New utilities (`lib/*.ts`) → Update `12-shared-services-and-components.rst`
- New hooks (`hooks/*.ts`) → Update `05-component-architecture.rst` or relevant chapter

### What to Document
- Purpose and usage examples
- Key functions/props with brief descriptions
- Integration patterns (how it connects to existing code)
- Any gotchas or platform-specific behavior

### Documentation Timing
Update docs in the same session as the code change, not as a separate task.

---

## Code Quality

### Keep It Simple
- DRY, modular code
- Three similar lines > premature abstraction
- Don't over-engineer

### Keep It Small
- Target ~400 LOC max per file
- Extract cohesive blocks to separate modules

### Remove Legacy Code
- Delete old code completely when replacing functionality
- Don't leave unused files or commented code

### Get User Approval Early
For complex features with multiple approaches, UX changes, or architectural decisions: present options and get approval before implementing.

---

## Feature Development & Commits

### When to Create GitHub Issues
**Always create a GitHub issue for:**
- New user-facing functionality (screens, buttons, workflows)
- New API integrations (endpoints, data types)
- Bug fixes (describe the bug, reproduction steps, expected behavior)
- Architectural changes (new stores, new patterns)

**Commit directly to main (no issue needed) for:**
- Documentation-only updates
- Refactoring without behavior change (same functionality, cleaner code)
- Test additions for existing, working code
- Dependency updates

### Workflow
1. **Create GitHub Issue first:**
   - Features: `gh issue create --title "feat: Description" --body "..." --label "enhancement"`
   - Bugs: `gh issue create --title "fix: Description" --body "Bug: ...\nSteps to reproduce: ...\nExpected: ..." --label "bug"`
2. Create branch: `git checkout -b feature/<short-description>`. Don't create a branch for bug fixes.
3. Implement with tests
4. Request user approval before merging
5. Tag all commits to the issue: `refs #<id>`
6. Use `fixes #<id>` in final commit to auto-close the issue after user confirms that the fix is working. DO NOT close issues automatically

### Commit Guidelines
- Detailed, descriptive messages (no vague summaries)
- One logical change per commit
- No superlative language (see Forbidden Actions)
- Use conventional format: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`

**Examples**:
- `fix: resolve overflow issue in flex containers`
- `feat: add haptic feedback to buttons`

### Issue References
- `refs #<id>` for references
- `fixes #<id>` to close issues

---

## Quick Decision Trees

**Adding a Feature?**
→ Create GitHub issue first, then: create feature branch, implement, test, update docs, reference issue in commits, update developer docs if needed

**Fixing a Bug?**
→ Create GitHub issue (describe bug + repro steps), write reproduction test, fix, verify test passes

**Adding UI?**
→ Need: `data-testid`, e2e test in .feature file, i18n keys in ALL languages, responsive check, text overflow handling

**Adding New API Module?**
→ Create in `api/`, update `docs/developer-guide/07-api-and-data-fetching.rst`

**Adding New Component?**
→ Create in `components/`, update `docs/developer-guide/05-component-architecture.rst`

**Adding New Utility?**
→ Create in `lib/`, update `docs/developer-guide/12-shared-services-and-components.rst`

**Adding HTTP Request?**
→ Use `httpGet`/`httpPost`/`httpPut`/`httpDelete` from `lib/http.ts`

**Adding Logging?**
→ Use `log.componentName(message, LogLevel.X, details)`

**Adding Capacitor Plugin?**
→ Match `@capacitor/core` version, add mock to setup.ts, use dynamic imports

**Adding User-Facing Text?**
→ Add i18n key to ALL translation files (en, de, es, fr, zh)

**Mobile Download?**
→ Use CapacitorHttp base64 directly, never convert to Blob

**Adding Polling/Auto-Refresh Feature?**
→ Use `useBandwidthSettings()` and appropriate interval property (e.g., `monitorStatusInterval`, `consoleEventsInterval`). If no matching property exists, add to `lib/zmninja-ng-constants.ts` with values for both normal and low modes.

---

## AI Agent Pitfalls

1. **Using superlative language** - NEVER use "comprehensive", "critical", "major", "robust", "powerful", etc. in responses, commits, docs, or code comments. Use plain, factual descriptions.
2. **Claiming success without verification** - Always run `npm test` AND relevant e2e tests
3. **Skipping tests for "simple" changes** - All changes need test verification
4. **Batching unrelated changes** - Split into separate commits
5. **Using wrong working directory** - All npm commands from `app/`
6. **Partial i18n updates** - Add to ALL language files
7. **Static Capacitor imports** - Use dynamic imports with platform check
8. **Forgetting data-testid** - All interactive elements need test selectors
9. **Not reading error output** - Analyze why tests failed, fix systematically
10. **Implementing without GitHub issue** - Create issue first for features and bugs
11. **Forgetting documentation updates** - Update developer-guide when adding APIs/components
12. **Hardcoding polling intervals** - Use `useBandwidthSettings()` for all polling/auto-refresh features

---

## grepai - Semantic Code Search

Use grepai as your primary tool for code exploration.

### When to Use grepai
- Understanding what code does or where functionality lives
- Finding implementations by intent ("authentication logic", "error handling")
- Exploring unfamiliar parts of the codebase

### When to Use Standard Grep/Glob
- Exact text matching (variable names, imports, specific strings)
- File path patterns (`**/*.ts`)

### Usage
```bash
grepai search "user authentication flow" --json --compact
grepai search "error handling middleware" --json --compact
```

### Call Graph Tracing
```bash
grepai trace callers "HandleRequest" --json
grepai trace callees "ProcessOrder" --json
grepai trace graph "ValidateToken" --depth 3 --json
```

### Fallback
If grepai fails, inform the user and fall back to standard Grep/Glob tools.
