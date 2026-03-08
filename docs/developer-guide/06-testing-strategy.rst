Testing Strategy
================

This chapter covers zmNinjaNG’s testing approach in detail, including unit
tests, E2E tests, and best practices.

Testing Philosophy
------------------

zmNinjaNG uses a two-tier testing strategy:

1. **Unit Tests**: Fast, isolated tests for logic and components
2. **E2E Tests**: Full user journey tests with a real ZoneMinder server

**Why both?** - Unit tests catch logic bugs quickly (< 2 seconds to run
all tests) - E2E tests catch integration issues and verify actual user
workflows - Together, they provide confidence that the app works
correctly

Unit Tests
----------

Technology Stack
~~~~~~~~~~~~~~~~

- **Vitest**: Fast test runner (Vite-based)
- **React Testing Library**: Component testing utilities
- **Testing Library User Event**: Simulate user interactions
- **vi.mock()**: Mocking dependencies

File Organization
~~~~~~~~~~~~~~~~~

Tests live next to the code they test in ``__tests__/`` subdirectories:

::

   src/
   ├── components/
   │   └── monitors/
   │       ├── MonitorCard.tsx
   │       └── __tests__/
   │           └── MonitorCard.test.tsx
   ├── lib/
   │   ├── crypto.ts
   │   └── __tests__/
   │       └── crypto.test.ts
   └── stores/
       ├── useProfileStore.ts
       └── __tests__/
           └── useProfileStore.test.ts

**Why co-located?** - Easy to find related tests - Tests are more likely
to be updated when code changes - Clear which code has test coverage

Running Unit Tests
~~~~~~~~~~~~~~~~~~

.. code:: bash

   # Run all unit tests
   npm test

   # Run specific test file
   npm test -- MonitorCard.test.tsx

   # Run tests matching pattern
   npm test -- dashboard

   # Watch mode (auto-rerun on changes)
   npm test -- --watch

   # With coverage report
   npm test -- --coverage

Writing Unit Tests
~~~~~~~~~~~~~~~~~~

Basic Test Structure
^^^^^^^^^^^^^^^^^^^^

.. code:: tsx

   // src/lib/__tests__/utils.test.ts
   import { describe, it, expect } from 'vitest';
   import { formatEventCount } from '../utils';

   describe('formatEventCount', () => {
     it('returns exact number for counts under 1000', () => {
       expect(formatEventCount(42)).toBe('42');
       expect(formatEventCount(999)).toBe('999');
     });

     it('formats thousands with K suffix', () => {
       expect(formatEventCount(1000)).toBe('1K');
       expect(formatEventCount(2500)).toBe('2.5K');
     });

     it('handles zero', () => {
       expect(formatEventCount(0)).toBe('0');
     });
   });

**Test structure:** - ``describe()``: Group related tests - ``it()``:
Individual test case - ``expect()``: Assertion

Testing React Components
^^^^^^^^^^^^^^^^^^^^^^^^

.. code:: tsx

   // src/components/monitors/__tests__/MonitorCard.test.tsx
   import { describe, it, expect, vi } from 'vitest';
   import { render, screen } from '@testing-library/react';
   import { MonitorCard } from '../MonitorCard';

   describe('MonitorCard', () => {
     const mockMonitor = {
       Id: '1',
       Name: 'Front Door',
       Width: '1920',
       Height: '1080',
       Function: 'Modect',
       Controllable: '0',
     };

     const mockStatus = {
       Status: 'Connected',
       CaptureFPS: '15.2',
     };

     it('renders monitor name', () => {
       render(
         <MonitorCard
           monitor={mockMonitor}
           status={mockStatus}
           eventCount={0}
           onShowSettings={vi.fn()}
         />
       );

       expect(screen.getByText('Front Door')).toBeInTheDocument();
     });

     it('displays status badge as "Live" when connected', () => {
       render(
         <MonitorCard
           monitor={mockMonitor}
           status={mockStatus}
           eventCount={0}
           onShowSettings={vi.fn()}
         />
       );

       const badge = screen.getByTestId('monitor-status');
       expect(badge).toHaveTextContent('Live');
     });

     it('shows FPS from status', () => {
       render(
         <MonitorCard
           monitor={mockMonitor}
           status={mockStatus}
           eventCount={0}
           onShowSettings={vi.fn()}
         />
       );

       expect(screen.getByText('15.2 FPS')).toBeInTheDocument();
     });

     it('calls onShowSettings when settings button clicked', async () => {
       const handleShowSettings = vi.fn();

       render(
         <MonitorCard
           monitor={mockMonitor}
           status={mockStatus}
           eventCount={0}
           onShowSettings={handleShowSettings}
         />
       );

       const settingsButton = screen.getByTestId('monitor-settings-button');
       await userEvent.click(settingsButton);

       expect(handleShowSettings).toHaveBeenCalledWith(mockMonitor);
     });
   });

**Key points:** - ``render()``: Renders component into test DOM -
``screen``: Query the rendered output - ``getByText()``,
``getByTestId()``: Find elements - ``toBeInTheDocument()``,
``toHaveTextContent()``: Assertions - ``vi.fn()``: Create mock functions
- ``userEvent.click()``: Simulate user interaction

Mocking Dependencies
^^^^^^^^^^^^^^^^^^^^

Components often depend on hooks, stores, or external modules. Mock
them:

**Mocking Zustand stores:**

.. code:: tsx

   import { vi } from 'vitest';
   import { useProfileStore } from '../../../stores/useProfileStore';

   // Mock the entire module
   vi.mock('../../../stores/useProfileStore');

   describe('ProfileSelector', () => {
     it('displays current profile name', () => {
       // Set up mock return value
       useProfileStore.mockReturnValue({
         currentProfile: { id: '1', name: 'My Profile' },
         profiles: [],
         setCurrentProfile: vi.fn(),
       });

       render(<ProfileSelector />);

       expect(screen.getByText('My Profile')).toBeInTheDocument();
     });
   });

**Mocking React Query:**

.. code:: tsx

   import { useQuery } from '@tanstack/react-query';

   vi.mock('@tanstack/react-query');

   describe('MonitorList', () => {
     it('renders monitors when loaded', () => {
       useQuery.mockReturnValue({
         data: {
           monitors: [
             { Monitor: { Id: '1', Name: 'Monitor 1' } },
             { Monitor: { Id: '2', Name: 'Monitor 2' } },
           ],
         },
         isLoading: false,
         error: null,
       });

       render(<MonitorList />);

       expect(screen.getByText('Monitor 1')).toBeInTheDocument();
       expect(screen.getByText('Monitor 2')).toBeInTheDocument();
     });

     it('shows skeleton when loading', () => {
       useQuery.mockReturnValue({
         data: null,
         isLoading: true,
         error: null,
       });

       render(<MonitorList />);

       expect(screen.getByTestId('monitor-list-skeleton')).toBeInTheDocument();
     });
   });

**Mocking custom hooks:**

.. code:: tsx

   import { useMonitorStream } from '../../../hooks/useMonitorStream';

   vi.mock('../../../hooks/useMonitorStream');

   describe('MonitorCard', () => {
     it('displays stream URL', () => {
       useMonitorStream.mockReturnValue({
         streamUrl: 'https://example.com/stream.jpg',
         displayedImageUrl: null,
         imgRef: { current: null },
         regenerateConnection: vi.fn(),
       });

       render(<MonitorCard monitor={mockMonitor} />);

       const img = screen.getByTestId('monitor-player');
       expect(img).toHaveAttribute('src', 'https://example.com/stream.jpg');
     });
   });

What to Test in Unit Tests
~~~~~~~~~~~~~~~~~~~~~~~~~~

Logic Functions
^^^^^^^^^^^^^^^

Test all code paths, edge cases, and error conditions:

.. code:: tsx

   describe('calculateMaxCols', () => {
     it('returns correct columns for standard widths', () => {
       expect(calculateMaxCols(1200, 300, 20)).toBe(4);
     });

     it('handles narrow widths', () => {
       expect(calculateMaxCols(320, 300, 20)).toBe(1);
     });

     it('handles zero margin', () => {
       expect(calculateMaxCols(1200, 300, 0)).toBe(4);
     });

     it('throws on invalid inputs', () => {
       expect(() => calculateMaxCols(-100, 300, 20)).toThrow();
     });
   });

Component Rendering
^^^^^^^^^^^^^^^^^^^

Test that components render correctly with different props:

.. code:: tsx

   it('renders with minimum props', () => {
     render(<MonitorCard monitor={mockMonitor} />);
     expect(screen.getByTestId('monitor-card')).toBeInTheDocument();
   });

   it('renders with all optional props', () => {
     render(
       <MonitorCard
         monitor={mockMonitor}
         status={mockStatus}
         eventCount={42}
         objectFit="contain"
         onShowSettings={vi.fn()}
       />
     );
     // Assertions...
   });

User Interactions
^^^^^^^^^^^^^^^^^

Test that clicking, typing, etc. work correctly:

.. code:: tsx

   it('updates input value when user types', async () => {
     render(<ProfileForm />);

     const nameInput = screen.getByPlaceholderText('Profile name');
     await userEvent.type(nameInput, 'My Server');

     expect(nameInput).toHaveValue('My Server');
   });

Store Actions
^^^^^^^^^^^^^

Test that store actions update state correctly:

.. code:: tsx

   import { useProfileStore } from '../useProfileStore';

   describe('ProfileStore', () => {
     beforeEach(() => {
       // Reset store before each test
       useProfileStore.setState({
         profiles: [],
         currentProfile: null,
       });
     });

     it('adds profile to list', () => {
       const profile = { id: '1', name: 'Test', portalUrl: 'http://test' };

       useProfileStore.getState().addProfile(profile);

       expect(useProfileStore.getState().profiles).toContain(profile);
     });

     it('sets current profile', () => {
       const profile = { id: '1', name: 'Test', portalUrl: 'http://test' };

       useProfileStore.getState().setCurrentProfile(profile);

       expect(useProfileStore.getState().currentProfile).toBe(profile);
     });
   });

Unit Testing Best Practices
~~~~~~~~~~~~~~~~~~~~~~~~~~~

1. **Test behavior, not implementation**

   - ✅ “When user clicks delete, monitor is removed”
   - ❌ “handleDelete function calls removeMonitor”

2. **Use data-testid for element queries**

   - ✅ ``screen.getByTestId('monitor-card')``
   - ❌ ``container.querySelector('.monitor-card-class-xyz')``

3. **Mock external dependencies**

   - Mock Zustand stores, React Query, custom hooks
   - Use real implementations for simple utilities

4. **Reset state between tests**

   - Use ``beforeEach()`` to reset stores, mocks
   - Tests should be independent

5. **Test edge cases**

   - Empty lists, null values, errors
   - Boundary conditions (max/min values)

E2E Tests
---------

.. _technology-stack-1:

Technology Stack
~~~~~~~~~~~~~~~~

- **Playwright**: Browser automation
- **playwright-bdd**: Gherkin/Cucumber integration
- **Real ZoneMinder server**: Tests connect to actual server

Why Playwright + Gherkin?
~~~~~~~~~~~~~~~~~~~~~~~~~

- **Gherkin** (``.feature`` files) makes tests readable by
  non-developers
- **Playwright** is fast, reliable, and cross-browser
- **playwright-bdd** bridges them together

.. _file-organization-1:

File Organization
~~~~~~~~~~~~~~~~~

::

   tests/
   ├── features/           # Gherkin feature files
   │   ├── dashboard.feature
   │   ├── monitors.feature
   │   ├── events.feature
   │   └── full-app-walkthrough.feature
   ├── steps.ts           # Step definitions
   ├── helpers/
   │   └── config.ts      # Test configuration
   └── README.md          # Testing documentation

Running E2E Tests
~~~~~~~~~~~~~~~~~

.. code:: bash

   # Run all E2E tests
   npm run test:e2e

   # Run specific feature
   npm run test:e2e -- dashboard.feature

   # Run multiple features
   npm run test:e2e -- dashboard.feature events.feature

   # Run in headed mode (see browser)
   npm run test:e2e -- --headed

   # Debug mode
   npm run test:e2e -- --debug

   # Run specific scenario by line number
   npm run test:e2e -- dashboard.feature:10

E2E Test Configuration
~~~~~~~~~~~~~~~~~~~~~~

Tests connect to a ZoneMinder server configured in ``.env``:

.. code:: bash

   # .env
   ZM_HOST_1=http://192.168.50.11
   ZM_USER_1=admin
   ZM_PASSWORD_1=admin

**Important**: E2E tests use **dynamic selectors** - they work with any
server that has at least one monitor. No hardcoded monitor names or IDs.

Writing E2E Tests
~~~~~~~~~~~~~~~~~

Gherkin Feature Files
^^^^^^^^^^^^^^^^^^^^^

Feature files describe user journeys in plain English:

.. code:: gherkin

   # tests/features/monitors.feature
   Feature: Monitor Management
     As a ZoneMinder user
     I want to view and manage my monitors
     So that I can watch my camera feeds

     Background:
       Given I am on the app home page
       When I select the first profile
       And I navigate to Monitors

     Scenario: View monitor list
       Then I should see at least 1 monitor card
       And each monitor card should show the monitor name
       And each monitor card should show a status badge

     Scenario: View monitor detail
       When I click on the first monitor card
       Then I should be on the monitor detail page
       And I should see the video player
       And I should see the monitor controls

     Scenario: Download monitor snapshot
       When I click the download button on the first monitor card
       Then a snapshot file should be downloaded

     Scenario: Filter monitors by status
       When I open the filter menu
       And I select "Connected" status filter
       Then I should only see connected monitors

**Gherkin Keywords:** - ``Feature``: Top-level description -
``Background``: Steps run before each scenario - ``Scenario``:
Individual test case - ``Given``: Set up initial state - ``When``: User
action - ``Then``: Expected outcome - ``And``, ``But``: Continuation

Step Definitions
^^^^^^^^^^^^^^^^

Step definitions implement the Gherkin steps:

.. code:: tsx

   // tests/steps.ts
   import { Given, When, Then, expect } from '@playwright/test';

   Given('I am on the app home page', async ({ page }) => {
     await page.goto('http://localhost:5173');
     await page.waitForLoadState('networkidle');
   });

   When('I select the first profile', async ({ page }) => {
     const profileCard = page.locator('[data-testid="profile-card"]').first();
     await profileCard.click();
   });

   When('I navigate to Monitors', async ({ page }) => {
     const monitorsLink = page.locator('[data-testid="nav-monitors"]');
     await monitorsLink.click();
     await page.waitForURL('**/monitors');
   });

   Then('I should see at least {int} monitor card(s)', async ({ page }, count) => {
     const cards = page.locator('[data-testid="monitor-card"]');
     await expect(cards).toHaveCount(await cards.count());
     expect(await cards.count()).toBeGreaterThanOrEqual(count);
   });

   When('I click on the first monitor card', async ({ page }) => {
     const firstCard = page.locator('[data-testid="monitor-card"]').first();
     await firstCard.click();
   });

   Then('I should be on the monitor detail page', async ({ page }) => {
     await page.waitForURL('**/monitors/**');
   });

   Then('I should see the video player', async ({ page }) => {
     const player = page.locator('[data-testid="video-player"]');
     await expect(player).toBeVisible();
   });

**Key Points:** - Use ``data-testid`` selectors:
``[data-testid="monitor-card"]`` - Use ``.first()``, ``.last()``,
``.nth(n)`` for list items (not hardcoded names/IDs) - Use dynamic
counts: ``toHaveCount(await cards.count())`` - Wait for navigation:
``waitForURL()`` - Wait for elements: ``toBeVisible()``

Dynamic Selectors (Critical)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

E2E tests must work with **any** ZoneMinder server. Never hardcode
monitor names or IDs:

**❌ Bad** (hardcoded):

.. code:: tsx

   When('I select Front Door monitor', async ({ page }) => {
     await page.locator('text=Front Door').click();  // Fails if server doesn't have this monitor
   });

**✅ Good** (dynamic):

.. code:: tsx

   When('I select the first monitor', async ({ page }) => {
     const firstMonitor = page.locator('[data-testid="monitor-card"]').first();
     await firstMonitor.click();  // Works with any monitor
   });

**Dynamic assertions:**

.. code:: tsx

   Then('I should see at least {int} monitor(s)', async ({ page }, count) => {
     const monitors = page.locator('[data-testid="monitor-card"]');
     expect(await monitors.count()).toBeGreaterThanOrEqual(count);
   });

What to Test in E2E Tests
~~~~~~~~~~~~~~~~~~~~~~~~~

User Journeys
^^^^^^^^^^^^^

Test complete workflows from start to finish:

.. code:: gherkin

   Scenario: Create profile and view monitors
     Given I am on the app home page
     When I click "Add Profile"
     And I enter profile details
     And I click "Save"
     Then I should see the new profile in the list
     When I select the profile
     And I navigate to Monitors
     Then I should see my monitors

Navigation
^^^^^^^^^^

Test that navigation works correctly:

.. code:: gherkin

   Scenario: Navigate between pages
     Given I am viewing a monitor
     When I click the back button
     Then I should be on the monitors page
     When I navigate to Dashboard
     Then I should be on the dashboard page

UI Interactions
^^^^^^^^^^^^^^^

Test that buttons, forms, dialogs work:

.. code:: gherkin

   Scenario: Add widget to dashboard
     Given I am on the dashboard page
     When I click "Edit Dashboard"
     And I click "Add Widget"
     And I select "Monitor Widget"
     And I select the first monitor
     And I click "Add"
     Then I should see the new widget on the dashboard

Error States
^^^^^^^^^^^^

Test that errors are handled gracefully:

.. code:: gherkin

   Scenario: Handle network error
     Given I am viewing monitors
     When the network connection is lost
     Then I should see an error message
     And I should see a retry button

E2E Testing Best Practices
~~~~~~~~~~~~~~~~~~~~~~~~~~

1. **Use Background for common setup**

   .. code:: gherkin

      Background:
        Given I am logged in
        And I have selected a profile

2. **One scenario = one user journey**

   - Keep scenarios focused and independent
   - Don’t test multiple unrelated things in one scenario

3. **Use dynamic selectors**

   - ``.first()``, ``.last()``, ``.nth(n)`` for lists
   - “at least N” instead of exact counts
   - Never hardcode monitor names/IDs

4. **Wait for elements**

   .. code:: tsx

      await page.waitForURL('**/monitors');
      await expect(element).toBeVisible();

5. **Test on mobile viewports too**

   .. code:: tsx

      // In playwright.config.ts
      projects: [
        { name: 'desktop', use: { viewport: { width: 1280, height: 720 } } },
        { name: 'mobile', use: { viewport: { width: 375, height: 667 } } },
      ]

Testing Workflow
----------------

Test-Driven Development (TDD)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Recommended workflow:**

1. **Write failing test** (or .feature file)

   .. code:: gherkin

      Scenario: Delete monitor
        When I click delete on a monitor
        Then the monitor should be removed from the list

2. **Implement feature**

   .. code:: tsx

      const handleDelete = async () => {
        await deleteMonitor(monitor.Id);
        refetch();
      };

3. **Run tests - verify they pass**

   .. code:: bash

      npm test
      npm run test:e2e -- monitors.feature

4. **Refactor if needed**

   - Improve code quality
   - Tests ensure behavior stays correct

Pre-Commit Checklist
~~~~~~~~~~~~~~~~~~~~

Before committing ANY code:

- ☐ Write/update unit tests
- ☐ Run ``npm test`` - all pass
- ☐ Run ``npm run typecheck`` - no errors
- ☐ Run ``npm run build`` - successful
- ☐ If UI changes: write/update E2E tests
- ☐ Run ``npm run test:e2e -- <feature>.feature`` - relevant tests pass
- ☐ State in commit message: “Tests verified: npm test ✓, npm run
  test:e2e – dashboard.feature ✓”

**Never commit if:** - ❌ Tests are failing - ❌ Tests don’t exist for
new functionality - ❌ You haven’t run the tests - ❌ Build fails

Debugging Tests
---------------

Unit Test Debugging
~~~~~~~~~~~~~~~~~~~

**Add console.log:**

.. code:: tsx

   it('renders monitor', () => {
     const { container } = render(<MonitorCard monitor={mockMonitor} />);
     console.log(container.innerHTML);  // See rendered HTML
     // ...
   });

**Use screen.debug():**

.. code:: tsx

   it('renders monitor', () => {
     render(<MonitorCard monitor={mockMonitor} />);
     screen.debug();  // Pretty-prints DOM
     // ...
   });

**Run single test:**

.. code:: bash

   npm test -- MonitorCard.test.tsx

E2E Test Debugging
~~~~~~~~~~~~~~~~~~

**Run in headed mode:**

.. code:: bash

   npm run test:e2e -- --headed

**Use debug mode:**

.. code:: bash

   npm run test:e2e -- --debug

**Add pauses in steps:**

.. code:: tsx

   When('I click on monitor', async ({ page }) => {
     await page.pause();  // Opens Playwright Inspector
     await page.click('[data-testid="monitor-card"]');
   });

**Take screenshots:**

.. code:: tsx

   Then('I should see monitors', async ({ page }) => {
     await page.screenshot({ path: 'debug-monitors.png' });
     // ...
   });

Test Coverage
-------------

Check test coverage to find untested code:

.. code:: bash

   npm test -- --coverage

Output:

::

   File                | % Stmts | % Branch | % Funcs | % Lines
   --------------------|---------|----------|---------|--------
   MonitorCard.tsx     |   92.5  |   85.7   |   90.0  |   92.5
   utils.ts            |   100   |   100    |   100   |   100

**Aim for:** - Critical code: 90%+ coverage - UI components: 70%+
coverage - Utilities: 100% coverage

Key Takeaways
-------------

1.  **Two-tier strategy**: Unit tests for logic, E2E for workflows
2.  **Co-locate tests**: Tests live next to code in :doc:``__tests__/``
3.  **Mock dependencies**: Zustand stores, React Query, custom hooks
4.  **Test behavior**: Not implementation details
5.  **Gherkin for E2E**: Readable user journeys in .feature files
6.  **Dynamic selectors**: ``.first()``, ``.last()``, “at least N”
7.  **Never hardcode**: Monitor names, IDs, exact counts
8.  **TDD workflow**: Write test → implement → verify → refactor
9.  **Pre-commit tests**: Run and pass all tests before committing
10. **Coverage tracking**: Use –coverage to find gaps

Next Steps
----------

Continue to `Chapter 7: API and Data
Fetching <07-api-and-data-fetching>` to learn how the app
interacts with ZoneMinder’s API.
