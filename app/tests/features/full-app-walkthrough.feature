Feature: Full Application Walkthrough
  As a ZoneMinder user
  I want to navigate through all application screens and interact with features
  So that I can verify the entire application works correctly

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

  Scenario: Dashboard - Add monitor widget with selection
    When I navigate to the "Dashboard" page
    Then I should see the page heading "Dashboard"
    When I open the Add Widget dialog
    And I select the "Monitor Stream" widget type
    And I select the first monitor in the widget dialog
    And I enter widget title "Test Monitor"
    And I click the Add button in the dialog
    Then the widget "Test Monitor" should appear on the dashboard

  Scenario: Monitors - View and interact with monitors
    When I navigate to the "Monitors" page
    Then I should see the page heading "Monitors"
    And I should see at least 1 monitor cards
    When I click into the first monitor detail page
    Then I should see the monitor player
    And I should see the monitor rotation status
    When I navigate back
    Then I should see the monitor grid

  Scenario: Montage - View camera grid and controls
    When I navigate to the "Montage" page
    Then I should see the page heading "Montage"
    And I should see the montage interface

  Scenario: Events - Browse and view event details
    When I navigate to the "Events" page
    Then I should see the page heading "Events"
    And I should see events list or empty state
    When I click into the first event if events exist
    And I navigate back if I clicked into an event
    Then I should be on the "Events" page
    When I switch events view to montage
    Then I should see the events montage grid

  Scenario: Events - Apply and clear filters
    When I navigate to the "Events" page
    Then I should see the page heading "Events"
    When I open the events filter panel
    And I set the events date range
    And I apply event filters
    Then I should see events list or empty state
    When I clear event filters
    Then I should see events list or empty state

  Scenario: Timeline - View and interact with timeline
    When I navigate to the "Timeline" page
    Then I should see the page heading "Timeline"
    And I should see timeline interface elements

  Scenario: Notifications - View notification settings and history
    When I navigate to the "Notifications" page
    Then I should see the page heading "Notification Settings"
    And I should see notification interface elements

  Scenario: Notifications - View history list
    When I navigate to the "Notifications" page
    And I navigate to the notification history
    Then I should see notification history page
    And I should see notification history content or empty state

  Scenario: Profiles - View and interact with profiles
    When I navigate to the "Profiles" page
    Then I should see the page heading "Profiles"
    And I should see at least 1 profile cards
    And I should see the active profile indicator
    And I should see profile management buttons

  Scenario: Profiles - Open edit and delete dialogs
    When I navigate to the "Profiles" page
    Then I should see the page heading "Profiles"
    When I open the edit dialog for the first profile
    Then I should see the profile edit dialog
    When I cancel profile edits
    Then I should see the profiles list
    When I open the delete dialog for the first profile if possible
    Then I should see the profile delete dialog
    When I cancel profile deletion
    Then I should see the profiles list

  Scenario: Settings - View and verify settings sections
    When I navigate to the "Settings" page
    Then I should see the page heading "Settings"
    And I should see settings interface elements

  Scenario: Server - View server information and status
    When I navigate to the "Server" page
    Then I should see the page heading "Server"
    And I should see server information displayed

  Scenario: Logs - View and interact with application logs
    When I navigate to the "Logs" page
    Then I should see the page heading "Logs"
    And I should see log entries or empty state
    And I should see log control elements
    And I change the log level to "WARN"
    And I clear logs if available
