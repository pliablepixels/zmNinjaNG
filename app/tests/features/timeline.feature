Feature: Timeline Visualization
  As a ZoneMinder user
  I want to view events on a timeline
  So that I can see patterns and browse events chronologically

  Background:
    Given I am logged into zmNinjaNG
    When I navigate to the "Timeline" page

  Scenario: View timeline interface
    Then I should see the page heading "Timeline"
    And I should see timeline interface elements

  Scenario: Timeline shows date filter controls
    Then I should see the start date picker
    And I should see the end date picker
    And I should see the monitor filter button

  Scenario: Timeline shows quick date range buttons
    Then I should see quick date range options
    When I click a quick date range option
    Then the date filters should update

  Scenario: Timeline shows refresh button
    Then I should see the refresh button
    When I click the refresh button
    Then the timeline should reload

  Scenario: Timeline shows loading state
    # Loading state is shown while fetching events
    Then I should see the timeline container

  Scenario: Timeline shows event statistics when events exist
    Then I should see the timeline visualization or empty state
    # If events exist, statistics cards are shown

  Scenario: Click event on timeline navigates to detail
    Given there are events on the timeline
    When I click on an event in the timeline
    Then I should navigate to the event detail page

  Scenario: Filter timeline by monitor
    When I click the monitor filter button
    Then I should see monitor filter options
    When I select a monitor from the filter
    Then the timeline should show only that monitor's events

  # Mobile tests run on mobile-chrome and mobile-safari projects which already have mobile viewport
  @mobile
  Scenario: Timeline is responsive on mobile
    Then I should see the page heading "Timeline"
    And the timeline controls should be accessible
    And the timeline should be scrollable
