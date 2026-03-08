Introduction to zmNinjaNG Development
================================

Welcome to the zmNinjaNG developer guide. This guide is designed for
experienced programmers who may not be familiar with React or modern
frontend development patterns.

What is zmNinjaNG?
-------------

zmNinjaNG is a cross-platform mobile and desktop application for ZoneMinder,
an open-source video surveillance system. It’s built using:

- **React**: A JavaScript library for building user interfaces
- **Ionic Framework**: Provides mobile-optimized UI components and
  navigation patterns
- **Capacitor**: Wraps the web app as a native iOS/Android app with
  access to device features
- **Tauri**: Wraps the web app as a native desktop app (macOS, Windows,
  Linux)
- **TypeScript**: A typed superset of JavaScript that catches errors at
  compile time

**The key insight**: zmNinjaNG is a web application that runs everywhere. The
same React code is packaged as: - A native iOS app (via Capacitor) - A
native Android app (via Capacitor) - A native desktop app (via Tauri) -
A web app (runs in browser)

This “write once, run anywhere” approach means you write React code, and
it runs on all platforms.

Who This Guide Is For
---------------------

This guide assumes you: - Are an experienced programmer in at least one
language - Understand basic programming concepts (variables, functions,
classes, etc.) - May not be familiar with React, JavaScript ecosystem,
or frontend development - Want to understand the architecture and
patterns used in zmNinjaNG

If you’re coming from backend development, Java, C++, Python, or similar
languages, we’ll explain React concepts from first principles.

What This Guide Covers
----------------------

Core Concepts (Chapters 2-4)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- **React Fundamentals**: How React works, components, hooks, and
  rendering
- **State Management with Zustand**: How we manage application state
- **Infinite Loops Explained**: A deep dive into a common pitfall we
  encountered

Practical Development (Chapters 5-7)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- **Component Patterns**: Common patterns used throughout the codebase
- **Testing Strategy**: Our approach to unit and E2E testing
- **Common Pitfalls**: Things to watch out for

Architecture (Chapters 8-11)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

- **API Architecture**: How we structure API calls and data fetching
- **Contributing Guide**: How to contribute code to the project
- **Key Libraries**: Justifications for our tech stack choices
- **Application Lifecycle**: The “Map” of how the app runs from start to
  finish

Learning Path
-------------

If you’re new to React: 1. Start with **Chapter 2: React Fundamentals**
- understand the mental model 2. Read **Chapter 3: State Management** -
understand how data flows 3. Study **Chapter 4: Infinite Loops** - learn
from our mistakes 4. Review **Chapter 6: Testing Strategy** - understand
how to verify your changes 5. Reference other chapters as needed

If you’re familiar with React:

- Skip to **Chapter 3** for Zustand-specific patterns
- Read **Chapter 4** to understand our specific infinite loop issues
- Review **Chapter 6** for our testing approach
- Read **Chapter 11** to understand the end-to-end runtime flow

Code Examples
-------------

Throughout this guide, we use real examples from the zmNinjaNG codebase. File
paths are shown relative to the :doc:``app/`` directory:

::

   app/
   ├── src/
   │   ├── components/     # Reusable UI components
   │   ├── pages/         # Screen/page components
   │   ├── stores/        # Zustand state stores
   │   ├── lib/           # Utility libraries
   │   └── locales/       # Internationalization files
   └── tests/             # Test files

Getting Help
------------

- Review ``AGENTS.md`` for development guidelines and checklists
- Check ``tests/README.md`` for testing documentation
- Look at existing code for patterns and examples

Next Steps
----------

Continue to `Chapter 2: React
Fundamentals <02-react-fundamentals>` to understand the
foundation of how this application works.
