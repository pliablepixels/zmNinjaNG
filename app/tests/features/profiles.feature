Feature: Profile Management
  As a ZoneMinder user
  I want to manage multiple server profiles
  So that I can connect to different ZoneMinder instances

  Background:
    Given I am logged into zmNinjaNG

  Scenario: View profiles list
    When I navigate to the "Profiles" page
    Then I should see the page heading "Profiles"
    And I should see at least 1 profile cards
    And I should see the active profile indicator
    And I should see profile management buttons

  Scenario: Open and cancel profile edit
    When I navigate to the "Profiles" page
    Then I should see the page heading "Profiles"
    When I open the edit dialog for the first profile
    Then I should see the profile edit dialog
    When I cancel profile edits
    Then I should see the profiles list

  Scenario: Open and cancel profile deletion
    When I navigate to the "Profiles" page
    Then I should see the page heading "Profiles"
    When I open the delete dialog for the first profile if possible
    Then I should see the profile delete dialog
    When I cancel profile deletion
    Then I should see the profiles list

  Scenario: View active profile indicator
    When I navigate to the "Profiles" page
    Then I should see the page heading "Profiles"
    And I should see the active profile indicator
    # Profile switching tested via profile-switcher component

  @mobile
  Scenario: Profiles page on mobile
    When I navigate to the "Profiles" page
    Then I should see the page heading "Profiles"
    And I should see at least 1 profile cards
