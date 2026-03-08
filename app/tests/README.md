# Testing Guide for zmNinjaNG

Comprehensive testing strategy with unit tests and BDD-first E2E tests.

## Quick Start

```bash
# Run all unit tests (fast)
npm test

# Start dev server with proxy (required for E2E in browser)
npm run dev:all

# Run all E2E tests
npm run test:e2e

# Run specific feature
npm run test:e2e -- tests/features/dashboard.feature

# Run E2E with UI mode
npm run test:e2e:ui
```

## Testing Strategy

zmNinjaNG uses a layered testing approach:

1. **Unit Tests** (Vitest) - Test pure functions, utilities, and logic
   - Fast execution (< 2 seconds)
   - Test edge cases, algorithms, security functions
   - Located in `src/lib/__tests__/`, `src/stores/__tests__/`, etc.

2. **E2E Tests** (Playwright + BDD) - Test user flows and integration
   - Gherkin feature files as source of truth
   - Test complete user journeys
   - Located in `tests/features/`

## Current Test Coverage

**Unit Tests**: 765+ tests across 58 files
- ✓ API validation and error handling
- ✓ Cryptographic functions (AES-GCM)
- ✓ Log sanitization (security-critical)
- ✓ URL utilities and derivation
- ✓ Time/timezone conversions
- ✓ Grid layout calculations
- ✓ Monitor filtering and rotation
- ✓ Video markers and timestamps
- ✓ Dashboard store
- ✓ Notification service
- ✓ Download utilities
- ✓ Profile validation

**E2E Tests**: 9 feature files with 74 scenarios covering all major features
- ✓ Dashboard widgets and editing (dashboard.feature - 8 scenarios)
- ✓ Monitor list, montage, and detail (monitors.feature - 7 scenarios)
- ✓ Monitor detail page controls (monitor-detail.feature - 7 scenarios)
- ✓ Event browsing, filtering, and favorites (events.feature - 14 scenarios)
- ✓ Timeline visualization and filtering (timeline.feature - 10 scenarios)
- ✓ Profile management (profiles.feature - 5 scenarios)
- ✓ Settings, server info, and logs (settings.feature - 7 scenarios)
- ✓ Go2RTC WebRTC streaming (go2rtc-streaming.feature - 3 scenarios)
- ✓ Full app navigation walkthrough (full-app-walkthrough.feature - 8 scenarios)

---

# Unit Tests

## Running Unit Tests

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- src/lib/__tests__/crypto.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## Writing Unit Tests

Unit tests use Vitest and follow this structure:

```typescript
import { describe, it, expect } from 'vitest';
import { functionToTest } from '../module';

describe('functionToTest', () => {
  describe('Success cases', () => {
    it('handles valid input', () => {
      const result = functionToTest('valid');
      expect(result).toBe('expected');
    });
  });

  describe('Edge cases', () => {
    it('handles empty input', () => {
      const result = functionToTest('');
      expect(result).toBe('');
    });
  });
});
```

## What to Unit Test

Focus on:
- **Pure functions** - Deterministic, no side effects
- **Algorithms** - Grid calculations, time conversions
- **Security-critical** - Encryption, sanitization, validation
- **Edge cases** - null, undefined, empty arrays, invalid input
- **Error handling** - Throw/catch behavior

Avoid:
- UI components (use E2E tests)
- Complex integration (use E2E tests)
- External API calls (mock or use E2E)

## Test File Location

Place tests next to the code they test:

```
src/lib/
├── crypto.ts
└── __tests__/
    └── crypto.test.ts

src/stores/
├── dashboard.ts
└── __tests__/
    └── dashboard.test.ts
```

## Mocking

Use Vitest mocking for dependencies:

```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('../logger', () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock a store
vi.mock('../../stores/settings', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      getProfileSettings: vi.fn(() => ({
        disableLogRedaction: false,
      })),
    })),
  },
}));
```

---

# E2E Tests

## Overview

All E2E tests are generated from Gherkin `.feature` files using playwright-bdd:

**Workflow:** Gherkin → Step Definitions → Generated Tests → Execution

```
tests/
├── features/
│   ├── dashboard.feature           # Dashboard widget tests (8 scenarios)
│   ├── monitors.feature            # Monitor list and montage tests (7 scenarios)
│   ├── monitor-detail.feature      # Monitor detail page tests (7 scenarios)
│   ├── events.feature              # Event browsing tests (14 scenarios)
│   ├── timeline.feature            # Timeline visualization tests (10 scenarios)
│   ├── profiles.feature            # Profile management tests (5 scenarios)
│   ├── settings.feature            # Settings, server, logs tests (7 scenarios)
│   ├── go2rtc-streaming.feature    # WebRTC streaming tests (3 scenarios)
│   └── full-app-walkthrough.feature # Full navigation walkthrough (8 scenarios)
├── helpers/
│   └── config.ts                   # Test configuration
├── steps.ts                        # Step implementations (150+ step definitions)
└── README.md                       # This file
```

## Configuration

Configure your ZoneMinder server in `.env`:

```env
ZM_HOST_1=http://192.168.1.100
ZM_USER_1=admin
ZM_PASSWORD_1=password
```

**Important:** E2E tests require the dev server with proxy:
```bash
npm run dev:all  # Starts both Vite (5173) and proxy server (3001)
```

The proxy is needed because browser security (CORS) blocks direct requests to ZoneMinder servers.

Timeout settings in `helpers/config.ts`:
- Overall test: 30s per test case
- Page transitions: 5s max
- Element visibility: 3s max

## Writing E2E Tests

### 1. Add Scenarios to the Feature File

Edit `tests/features/full-app-walkthrough.feature`:

```gherkin
Feature: Full Application Walkthrough
  As a ZoneMinder user
  I want to navigate through all application screens
  So that I can verify the application works correctly

  Background:
    Given I am logged into zmNinjaNG

  Scenario: Dashboard - Add and verify widget
    When I navigate to the "Dashboard" page
    Then I should see the page heading "Dashboard"
    When I open the Add Widget dialog
    And I select the "Timeline" widget type
    And I enter widget title "Test Timeline"
    And I click the Add button in the dialog
    Then the widget "Test Timeline" should appear on the dashboard
```

### 2. Implement Steps (if needed)

If you need new steps, add them to `tests/steps.ts`:

```typescript
import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';

const { Given, When, Then } = createBdd();

When('I perform a new action', async ({ page }) => {
  await page.getByRole('button', { name: 'Action' }).click();
});

Then('I should see the new result', async ({ page }) => {
  await expect(page.getByText('Result')).toBeVisible();
});
```

### 3. Check Available Steps

Before writing new steps, check what's already available:

```bash
npx bddgen export
```

This shows all 27 existing step definitions you can reuse.

### 4. Run Tests

```bash
npm run test:e2e       # Generate from Gherkin + run tests
npm run test:e2e:ui    # Run with UI mode
```

## E2E Best Practices

### Element Selection Priority

1. **data-testid** (Preferred)
   ```typescript
   page.getByTestId('monitor-card')
   ```

2. **Role-based selectors**
   ```typescript
   page.getByRole('button', { name: /submit/i })
   ```

3. **Text content**
   ```typescript
   page.getByText('Monitor name')
   ```

4. **Avoid CSS selectors and XPath** (fragile)

### Gherkin Guidelines

```gherkin
# Good - Specific and testable
Scenario: User adds a monitor and verifies it appears
  When I click the "Add Monitor" button
  And I enter "Front Door" as the monitor name
  Then I should see a monitor card with name "Front Door"

# Bad - Vague and untestable
Scenario: Monitor works
  When I do stuff
  Then it works
```

### Step Definition Guidelines

1. Keep steps simple - each does one thing
2. Use data-testid for element selection
3. Wait for specific conditions, not arbitrary timeouts
4. Reuse existing steps (`npx bddgen export`)
5. Use parameters: `{string}`, `{int}` for flexibility

## Debugging E2E Tests

### View Traces

All tests capture traces (timeline with screenshots):

```bash
npx playwright show-trace test-results/*/trace.zip
```

### Use UI Mode

Interactive debugging:

```bash
npm run test:e2e:ui
```

### Console Logs

Add logs in step definitions:

```typescript
Then('I verify something', async ({ page }) => {
  console.log('Current URL:', page.url());
  // ...
});
```

## How E2E Tests Work

1. **Write Gherkin** - Edit `features/full-app-walkthrough.feature`
2. **BDD generates tests** - `bddgen` creates `.features-gen/*.spec.js`
3. **Playwright runs tests** - Standard Playwright execution
4. **View results** - HTML reports with traces

The `.features-gen/` directory contains auto-generated tests - never edit these manually.

---

# Testing Workflow

## Before Committing

```bash
# Run unit tests (fast)
npm test

# Run E2E tests (slower, ensure server is configured)
npm run test:e2e
```

## When to Use Each Type

**Unit Tests** when:
- Testing pure functions (crypto, sanitization, formatting)
- Testing algorithms (grid calculations, time conversions)
- Testing edge cases (null, undefined, empty values)
- Testing error handling
- Quick feedback needed

**E2E Tests** when:
- Testing user flows (login → navigate → interact)
- Testing integration between components
- Testing UI interactions
- Verifying complete features work end-to-end

## Additional Resources

- [Vitest Documentation](https://vitest.dev)
- [Playwright Documentation](https://playwright.dev)
- [playwright-bdd Documentation](https://vitalets.github.io/playwright-bdd)
- [Gherkin Reference](https://cucumber.io/docs/gherkin/reference/)

## Contributing Tests

### Adding Unit Tests

1. Create test file next to source: `__tests__/module.test.ts`
2. Write comprehensive tests (success, failure, edge cases)
3. Run `npm test` to verify
4. Commit changes

### Adding E2E Tests

1. Add scenario to `features/full-app-walkthrough.feature`
2. Implement new steps in `steps.ts` (if needed)
3. Run `npm run test:e2e`
4. Verify all tests pass
5. Commit changes

Keep tests focused, well-organized, and comprehensive.
