Feature: Dashboard Customization
  As a ZoneMinder user
  I want to customize my dashboard with widgets
  So that I can see the information I care about

  Background:
    Given I am logged into zmNinjaNG

  Scenario: Add a timeline widget
    When I navigate to the "Dashboard" page
    Then I should see the page heading "Dashboard"
    When I open the Add Widget dialog
    And I select the "Timeline" widget type
    And I enter widget title "Test Timeline"
    And I click the Add button in the dialog
    Then the widget "Test Timeline" should appear on the dashboard

  Scenario: Add a monitor widget with selection
    When I navigate to the "Dashboard" page
    Then I should see the page heading "Dashboard"
    When I open the Add Widget dialog
    And I select the "Monitor Stream" widget type
    And I select the first monitor in the widget dialog
    And I enter widget title "Test Monitor"
    And I click the Add button in the dialog
    Then the widget "Test Monitor" should appear on the dashboard

  Scenario: Add a Recent Events widget without infinite loop
    When I navigate to the "Dashboard" page
    Then I should see the page heading "Dashboard"
    When I open the Add Widget dialog
    And I select the "Events" widget type
    And I enter widget title "Recent Events"
    And I click the Add button in the dialog
    Then the widget "Recent Events" should appear on the dashboard
    And no console errors should be present

  Scenario: Add multiple widgets in sequence
    When I navigate to the "Dashboard" page
    Then I should see the page heading "Dashboard"
    When I open the Add Widget dialog
    And I select the "Timeline" widget type
    And I enter widget title "Timeline 1"
    And I click the Add button in the dialog
    Then the widget "Timeline 1" should appear on the dashboard
    When I open the Add Widget dialog
    And I select the "Events" widget type
    And I enter widget title "Recent Events"
    And I click the Add button in the dialog
    Then the widget "Recent Events" should appear on the dashboard
    When I open the Add Widget dialog
    And I select the "Event Heatmap" widget type
    And I enter widget title "Heatmap"
    And I click the Add button in the dialog
    Then the widget "Heatmap" should appear on the dashboard
    And no console errors should be present

  Scenario: View dashboard without widgets
    When I navigate to the "Dashboard" page
    Then I should see the page heading "Dashboard"
    # Empty dashboard state tested via EmptyState component

  Scenario: Edit a widget title
    When I navigate to the "Dashboard" page
    Then I should see the page heading "Dashboard"
    When I open the Add Widget dialog
    And I select the "Timeline" widget type
    And I enter widget title "Original Title"
    And I click the Add button in the dialog
    Then the widget "Original Title" should appear on the dashboard
    When I enter dashboard edit mode
    And I click the widget edit button on the first widget
    Then I should see the widget edit dialog
    When I change the widget title to "Updated Title"
    And I save the widget changes
    Then the widget "Updated Title" should appear on the dashboard

  Scenario: Delete a widget
    When I navigate to the "Dashboard" page
    Then I should see the page heading "Dashboard"
    When I open the Add Widget dialog
    And I select the "Timeline" widget type
    And I enter widget title "Widget To Delete"
    And I click the Add button in the dialog
    Then the widget "Widget To Delete" should appear on the dashboard
    When I enter dashboard edit mode
    And I click the widget delete button on the first widget
    Then the widget should be removed from the dashboard

  @mobile
  Scenario: Dashboard displays in mobile layout
    When I navigate to the "Dashboard" page
    Then I should see the page heading "Dashboard"
    And the add widget button should be visible
