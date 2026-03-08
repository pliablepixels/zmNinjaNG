Feature: Monitor Group Filtering
  As a ZoneMinder user
  I want to filter monitors by group
  So that I can focus on specific camera groups

  Background:
    Given I am logged into zmNinjaNG

  Scenario: Group filter is visible on Monitors page when groups exist
    When I navigate to the "Monitors" page
    Then I should see the page heading "Monitors"
    And I should see the group filter if groups are available

  Scenario: Group filter is visible on Montage page when groups exist
    When I navigate to the "Montage" page
    Then I should see the page heading "Montage"
    And I should see the group filter if groups are available

  Scenario: Group filter is visible on Events page when groups exist
    When I navigate to the "Events" page
    Then I should see the page heading "Events"
    And I should see the group filter if groups are available

  Scenario: Select a group to filter monitors
    When I navigate to the "Monitors" page
    And I select a group from the filter if available
    Then the filter should be applied

  @mobile
  Scenario: Group filter on mobile Monitors page
    When I navigate to the "Monitors" page
    Then I should see the page heading "Monitors"
    And I should see the group filter if groups are available
