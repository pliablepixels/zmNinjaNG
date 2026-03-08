Developer Guide
===============

This guide teaches you how to work on the zmNinjaNG codebase. It is written for
developers who may not have React experience, explaining concepts from first
principles with real examples from the code.

**New to React?** Start with Chapter 2 (React Fundamentals), then Chapter 3 (Zustand).

**Adding a feature?** Read Chapter 9 (Contributing) for the workflow, then
Chapter 6 (Testing).

**Debugging?** Check Chapter 8 (Common Pitfalls) for previously encountered
bugs and their fixes.

**Understanding the architecture?** Chapter 5 (Component Architecture) explains
file organization, and Chapter 11 (Application Lifecycle) explains the runtime flow.

.. toctree::
   :maxdepth: 2

   01-introduction
   02-react-fundamentals
   03-state-management-zustand
   04-pages-and-views
   05-component-architecture
   06-testing-strategy
   07-api-and-data-fetching
   08-common-pitfalls
   09-contributing
   10-key-libraries
   11-application-lifecycle
   12-shared-services-and-components
   go2rtc-integration


Quick Reference
---------------

State Types
^^^^^^^^^^^

.. list-table::
   :header-rows: 1

   * - Type
     - Where
     - Example
     - When to Use
   * - **Local**
     - ``useState``
     - Form inputs, UI toggles
     - Component-specific, temporary
   * - **Global**
     - Zustand stores
     - Current profile, settings
     - Shared across components
   * - **Server**
     - React Query
     - Monitor list, events
     - Data from ZoneMinder API

File Organization
^^^^^^^^^^^^^^^^^

::

   app/src/
   ├── api/          # API functions (thin wrappers around HTTP client)
   ├── components/   # React components (visual)
   ├── hooks/        # Custom React hooks (component logic)
   ├── lib/          # Pure utilities (no React dependencies)
   ├── pages/        # Route-level views
   ├── services/     # Platform-specific code (Capacitor plugins)
   ├── stores/       # Global state (Zustand)
   └── locales/      # i18n translations (en, de, es, fr, zh)

Development Quick Start
^^^^^^^^^^^^^^^^^^^^^^^

.. code-block:: bash

   cd app
   npm install
   npm run dev      # Start development server
   npm test         # Run unit tests
   npm run build    # Build for production

Also see the `AGENTS.md <https://github.com/pliablepixels/zmNinjaNG/blob/main/AGENTS.md>`_
file for the full development guidelines and checklists.
