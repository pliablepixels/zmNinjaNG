Feature: Application Settings
  As a ZoneMinder user
  I want to configure application settings
  So that I can customize the app to my preferences

  Background:
    Given I am logged into zmNinjaNG

  Scenario: View settings page
    When I navigate to the "Settings" page
    Then I should see the page heading "Settings"
    And I should see settings interface elements

  Scenario: View notification settings
    When I navigate to the "Notifications" page
    Then I should see the page heading "Notification Settings"
    And I should see notification interface elements

  Scenario: View notification history
    When I navigate to the "Notifications" page
    And I navigate to the notification history
    Then I should see notification history page
    And I should see notification history content or empty state

  Scenario: View server information
    When I navigate to the "Server" page
    Then I should see the page heading "Server"
    And I should see server information displayed

  Scenario: View application logs
    When I navigate to the "Logs" page
    Then I should see the page heading "Logs"
    And I should see log entries or empty state
    And I should see log control elements
    And I change the log level to "WARN"
    And I clear logs if available

  Scenario: Settings has theme controls
    When I navigate to the "Settings" page
    Then I should see theme selector
    And I should see language selector

  @mobile
  Scenario: Settings page on mobile
    When I navigate to the "Settings" page
    Then I should see the page heading "Settings"
    And I should see settings interface elements
