Contributing to zmNinjaNG
====================

This chapter covers the workflow for contributing code to the zmNinjaNG
project.

Before You Start
----------------

1. **Read the documentation**

   - This developer guide (chapters 1-8)
   - ``AGENTS.md`` - Development guidelines and requirements
   - ``tests/README.md`` - Testing documentation

2. **Set up your development environment**

   .. code:: bash

      # Clone the repository
      git clone https://github.com/your-org/zmNinjaNG.git
      cd zmNinjaNG/app

      # Install dependencies
      npm install

      # Set up test server credentials
      cp .env.example .env
      # Edit .env with your ZoneMinder server details

      # Run the app
      npm run dev

      # Run tests to ensure setup is correct
      npm test
      npm run typecheck
      npm run build

3. **Understand the codebase**

   - Review the architecture (chapters 4-5)
   - Look at existing code for patterns
   - Run the app and explore features

Development Workflow
--------------------

1. Pick or Create an Issue
~~~~~~~~~~~~~~~~~~~~~~~~~~

- Check existing issues on GitHub
- If no issue exists for your change, create one
- Discuss the approach before writing code (for large changes)

2. Create a Branch
~~~~~~~~~~~~~~~~~~

.. code:: bash

   # Create branch from main
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name

   # Or for bug fixes:
   git checkout -b fix/issue-123-bug-description

**Branch naming:** - ``feature/description`` - New features -
``fix/description`` - Bug fixes - ``refactor/description`` - Code
improvements - ``docs/description`` - Documentation updates -
``test/description`` - Test additions/fixes

3. Write Code
~~~~~~~~~~~~~

Follow the patterns in this guide and AGENTS.md:

**Code quality:** - Keep files small and focused - Follow DRY principles
- Don’t over-engineer - Write clear comments for “why”, not “what”

**Testing (MANDATORY):** - Write tests BEFORE or DURING implementation -
Unit tests for all new logic/components - E2E tests for UI changes and
user journeys

**Internationalization:** - No hardcoded user-facing text - Update ALL
language files (en, de, es, fr, zh)

**Logging:** - Use component-specific log helpers - Always specify
LogLevel - Never use console.\*

**Data attributes:** - Add ``data-testid`` to all interactive elements -
Use kebab-case naming

4. Run Tests
~~~~~~~~~~~~

**CRITICAL**: All tests must pass before committing.

.. code:: bash

   # Unit tests
   npm test

   # Type checking
   npm run typecheck

   # Build
   npm run build

   # E2E tests (if UI changed)
   npm run test:e2e -- <relevant-feature>.feature

**If tests fail:** - Fix the code AND/OR fix the tests - Never commit
failing tests - Never skip tests

5. Commit Changes
~~~~~~~~~~~~~~~~~

**Commit message format:**

::

   <type>: <description>

   [optional body]

   [optional footer]

**Types:** - ``feat:`` - New feature - ``fix:`` - Bug fix - ``docs:`` -
Documentation changes - ``test:`` - Test changes - ``refactor:`` - Code
restructuring - ``chore:`` - Maintenance tasks

**Examples:**

.. code:: bash

   # Good commits
   git commit -m "feat: add PTZ preset buttons to monitor detail page

   - Implemented preset selection UI
   - Added API integration for preset recall
   - Updated MonitorDetail component tests

   Tests verified: npm test ✓, npm run test:e2e -- monitors.feature ✓"

   git commit -m "fix: resolve infinite loop in DashboardLayout

   Used refs for currentProfile and updateSettings to prevent
   callback recreation on every render.

   Fixes #42

   Tests verified: npm test ✓"

   git commit -m "docs: update testing strategy chapter with pagination examples"

.. code:: bash

   # Bad commits
   git commit -m "fixed bug"  # ❌ Too vague
   git commit -m "wip"        # ❌ Not complete
   git commit -m "test"       # ❌ Not descriptive

**Split unrelated changes:**

.. code:: bash

   # ❌ Don't do this:
   git commit -m "fix login bug and add dark mode and update docs"

   # ✅ Do this:
   git commit -m "fix: resolve login token refresh race condition"
   git commit -m "feat: implement dark mode theme toggle"
   git commit -m "docs: document theme customization"

**Reference issues:**

.. code:: bash

   # Reference an issue (doesn't close it)
   git commit -m "feat: add monitor sorting options

   Adds dropdown to sort monitors by name, ID, or status.

   refs #123"

   # Close an issue with the commit
   git commit -m "fix: prevent duplicate profiles in list

   Fixes #45"

6. Push and Create Pull Request
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code:: bash

   # Push your branch
   git push origin feature/your-feature-name

   # Create PR on GitHub
   # - Use a clear title
   # - Describe what changed and why
   # - Reference related issues
   # - Include test verification statement

**Pull Request Template:**

.. code:: markdown

   ## Description

   Brief description of changes and motivation.

   Fixes #<issue-number>

   ## Changes Made

   - Added X feature
   - Refactored Y component
   - Updated Z tests

   ## Testing

   - [ ] Unit tests added/updated
   - [ ] E2E tests added/updated (if UI changed)
   - [ ] All tests passing
   - [ ] Type checking passes
   - [ ] Build succeeds

   Tests verified:
   - npm test ✓
   - npm run typecheck ✓
   - npm run build ✓
   - npm run test:e2e -- monitors.feature ✓

   ## Screenshots (if UI changed)

   [Add screenshots]

   ## Checklist

   - [ ] Followed AGENTS.md guidelines
   - [ ] Updated all language files (en, de, es, fr, zh)
   - [ ] Added data-testid to new interactive elements
   - [ ] Used structured logging (no console.*)
   - [ ] No sensitive data in logs
   - [ ] Code is DRY and modular

7. Code Review
~~~~~~~~~~~~~~

- Address reviewer feedback promptly
- Make requested changes in new commits (don’t force-push)
- Re-run tests after changes
- Update PR description if scope changes

**Common review feedback:**

- Missing tests
- Hardcoded text (needs i18n)
- Missing data-testid attributes
- Using console.\* instead of log helpers
- Not updating all language files
- Complex code needs comments
- Performance issues (missing memo/useMemo)

8. Merge
~~~~~~~~

Once approved: - Squash commits if requested - Ensure CI passes -
Maintainer will merge

Code Review Guidelines
----------------------

When reviewing others’ PRs:

Functional Requirements
~~~~~~~~~~~~~~~~~~~~~~~

- ☐ Does it solve the stated problem?
- ☐ Are there edge cases not handled?
- ☐ Does it introduce new bugs?

Code Quality
~~~~~~~~~~~~

- ☐ Is the code clear and readable?
- ☐ Are functions/components reasonably sized?
- ☐ Is it DRY (not duplicating existing code)?
- ☐ Are variable/function names descriptive?

Testing
~~~~~~~

- ☐ Are there unit tests?
- ☐ Are there E2E tests (if UI changed)?
- ☐ Do tests actually test the feature?
- ☐ Are tests clear and maintainable?

Guidelines Compliance
~~~~~~~~~~~~~~~~~~~~~

- ☐ Follows AGENTS.md requirements?
- ☐ All language files updated?
- ☐ Has data-testid attributes?
- ☐ Uses structured logging?
- ☐ No console.\* statements?

Performance
~~~~~~~~~~~

- ☐ Are expensive operations memoized?
- ☐ Are list components memoized?
- ☐ Any unnecessary re-renders?

Security
~~~~~~~~

- ☐ No sensitive data in logs?
- ☐ Credentials stored encrypted?
- ☐ No XSS/injection vulnerabilities?

Common Contribution Scenarios
-----------------------------

Adding a New Feature
~~~~~~~~~~~~~~~~~~~~

1. Create issue describing the feature
2. Discuss approach with maintainers
3. Create branch: ``feature/feature-name``
4. Implement feature with tests
5. Update relevant documentation
6. Create PR with screenshots/videos

**Example: Adding a “Favorites” feature**

.. code:: bash

   # 1. Create branch
   git checkout -b feature/monitor-favorites

   # 2. Implement (in order):
   # - Add favorites array to ProfileSettings type
   # - Update useProfileStore with addFavorite/removeFavorite actions
   # - Add star icon to MonitorCard
   # - Filter monitors page to show favorites first
   # - Add i18n keys to all language files
   # - Add data-testid to star button

   # 3. Write tests
   # - Unit test: ProfileStore favorites actions
   # - Unit test: MonitorCard renders star button
   # - E2E test: User can favorite/unfavorite monitors

   # 4. Run all tests
   npm test
   npm run test:e2e -- monitors.feature

   # 5. Commit
   git commit -m "feat: add monitor favorites feature

   Users can now star monitors to mark them as favorites.
   Favorites appear first in the monitors list.

   - Added favorites array to ProfileSettings
   - Implemented favorite toggle in MonitorCard
   - Updated monitors list to sort favorites first
   - Added unit and E2E tests

   Tests verified: npm test ✓, npm run test:e2e -- monitors.feature ✓

   refs #78"

   # 6. Push and create PR
   git push origin feature/monitor-favorites

Fixing a Bug
~~~~~~~~~~~~

1. Create/find issue describing the bug
2. Write a failing test that reproduces the bug
3. Fix the bug
4. Verify test now passes
5. Create PR

**Example: Fixing a stream connection bug**

.. code:: bash

   # 1. Create branch
   git checkout -b fix/stream-reconnect-loop

   # 2. Write failing test
   # - test/features/monitors.feature: Add scenario that triggers bug
   # - Verify test fails

   # 3. Fix the bug
   # - Identify root cause (connkey regeneration infinite loop)
   # - Apply ref pattern to fix

   # 4. Verify
   npm test
   npm run test:e2e -- monitors.feature  # Test now passes

   # 5. Commit
   git commit -m "fix: prevent infinite connkey regeneration loop

   Used refs for currentProfile and regenerateConnection to avoid
   creating new callback instances on every render.

   The bug caused ResizeObserver to repeatedly trigger connection
   regeneration, flooding the server with requests.

   Fixes #92

   Tests verified: npm test ✓, npm run test:e2e -- monitors.feature ✓"

Updating Documentation
~~~~~~~~~~~~~~~~~~~~~~

1. Create branch: ``docs/description``
2. Make changes
3. Verify documentation renders correctly
4. Create PR

.. code:: bash

   git checkout -b docs/improve-testing-guide

   # Make changes to docs/developer-guide/06-testing-strategy.md

   git commit -m "docs: add pagination testing examples to testing strategy

   Added section on testing infinite scroll and useInfiniteQuery patterns"

   git push origin docs/improve-testing-guide

Style Guide
-----------

TypeScript
~~~~~~~~~~

.. code:: tsx

   // ✅ Use interfaces for props
   interface MonitorCardProps {
     monitor: Monitor;
     onPress?: () => void;
   }

   // ✅ Use type for unions/intersections
   type Status = 'loading' | 'success' | 'error';

   // ✅ Explicit return types for public functions
   export function calculateMaxCols(width: number): number {
     return Math.floor(width / MIN_CARD_WIDTH);
   }

   // ✅ Avoid any - use unknown or specific type
   function processData(data: unknown) {
     if (typeof data === 'string') {
       // ...
     }
   }

React Components
~~~~~~~~~~~~~~~~

.. code:: tsx

   // ✅ Function declaration for named exports
   export function MonitorCard({ monitor }: MonitorCardProps) {
     // ...
   }

   // ✅ Arrow function for inline components
   const Item = ({ name }: { name: string }) => <div>{name}</div>;

   // ✅ Destructure props in parameter
   export function MonitorCard({ monitor, onPress }: MonitorCardProps) {
     // Not: function MonitorCard(props) { const { monitor } = props; }
   }

   // ✅ Early returns for guards
   export function MonitorCard({ monitor }: MonitorCardProps) {
     if (!monitor) return null;
     if (monitor.deleted) return <DeletedCard />;

     return <Card>...</Card>;
   }

Naming Conventions
~~~~~~~~~~~~~~~~~~

.. code:: tsx

   // Components: PascalCase
   function MonitorCard() {}

   // Hooks: camelCase with 'use' prefix
   function useMonitorStream() {}

   // Constants: UPPER_SNAKE_CASE
   const MAX_RETRIES = 3;
   const API_BASE_URL = 'https://api.example.com';

   // Variables/functions: camelCase
   const monitorList = [];
   function fetchMonitors() {}

   // Files:
   // - Components: PascalCase (MonitorCard.tsx)
   // - Hooks: camelCase (useMonitorStream.ts)
   // - Utils: camelCase (formatDate.ts)
   // - Tests: Same as source (MonitorCard.test.tsx)

Mobile Development
------------------

zmNinjaNG is a cross-platform app built with
`Capacitor <https://capacitorjs.com/>`__.

Prerequisites
~~~~~~~~~~~~~

- **Node.js**: 18+
- **Android Studio**: For Android development (installs Android SDK/JDK)
- **Xcode**: For iOS development (macOS only)

Running on Device/Emulator
~~~~~~~~~~~~~~~~~~~~~~~~~~

The project includes helper scripts in ``package.json`` to streamline
the mobile workflow.

**Android:**

.. code:: bash

   # Sync web assets to Android project and open Android Studio
   npm run android

   # Just sync (if you already have Android Studio open)
   npm run android:sync

   # View logs from connected Android device
   npm run android:logs

**iOS:**

.. code:: bash

   # Sync web assets to iOS project and open Xcode
   npm run ios

   # Just sync
   npm run ios:sync

Workflow
~~~~~~~~

1. Make changes to the web code (``src/``).
2. Run ``npm run build`` to compile the web assets.
3. Run ``npm run android:sync`` or ``npm run ios:sync`` to copy the
   built assets to the native projects.
4. Run/Debug via Android Studio or Xcode.

..

   [!TIP] **Live Reload**: For faster development, you can configure
   Capacitor to load the dev server URL instead of the built bundle.
   Edit ``capacitor.config.ts``:

   .. code:: ts

      server: {
        url: 'http://YOUR_LOCAL_IP:5173',
        cleartext: true
      }

   Remember to remove this before building for release!

Getting Help
------------

- **Questions about the codebase**: Create a GitHub discussion
- **Bug reports**: Create a GitHub issue
- **Feature requests**: Create a GitHub issue
- **Security issues**: Email maintainers (don’t create public issue)

License
-------

By contributing, you agree that your contributions will be licensed
under the same license as the project.

Recognition
-----------

Contributors will be recognized in: - CONTRIBUTORS.md file - Release
notes for features/fixes - Git commit history

Thank you for contributing to zmNinjaNG!
