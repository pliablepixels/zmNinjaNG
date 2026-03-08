Feature: Monitor Management and Viewing
  As a ZoneMinder user
  I want to view and interact with monitors
  So that I can see live feeds and control cameras

  Background:
    Given I am logged into zmNinjaNG

  Scenario: View monitors list
    When I navigate to the "Monitors" page
    Then I should see the page heading "Monitors"
    And I should see at least 1 monitor cards

  Scenario: View monitor detail with live feed
    When I navigate to the "Monitors" page
    And I click into the first monitor detail page
    Then I should see the monitor player
    And I should see the monitor rotation status
    When I navigate back
    Then I should see the monitor grid

  Scenario: Toggle zone overlay on monitor detail
    When I navigate to the "Monitors" page
    And I click into the first monitor detail page
    Then I should see the monitor player
    And I should see the zone toggle button
    When I click the zone toggle button
    Then the zone toggle should be active

  Scenario: Navigate between monitors using swipe
    When I navigate to the "Monitors" page
    And I click into the first monitor detail page
    Then I should see the monitor player
    # Note: Swipe navigation tested via useSwipeNavigation hook unit tests

  Scenario: View monitor montage grid
    When I navigate to the "Montage" page
    Then I should see the page heading "Montage"
    And I should see the montage interface

  Scenario: Montage grid shows monitors
    When I navigate to the "Montage" page
    Then I should see the page heading "Montage"
    And I should see at least 1 monitor in montage grid

  @mobile
  Scenario: Monitors page on mobile
    When I navigate to the "Monitors" page
    Then I should see the page heading "Monitors"
    And I should see at least 1 monitor cards

  @mobile
  Scenario: Montage page on mobile
    When I navigate to the "Montage" page
    Then I should see the page heading "Montage"
    And I should see the montage interface
