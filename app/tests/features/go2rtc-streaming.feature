Feature: Go2RTC WebRTC Streaming

  Background:
    Given I am logged into zmNinjaNG

  Scenario: View monitor with VideoPlayer in Montage
    When I navigate to the "Montage" page
    Then I should see at least 1 monitor cards

  Scenario: View monitor detail with video player
    When I navigate to the "Montage" page
    And I click into the first monitor detail page
    Then I should see the monitor player

  Scenario: Download snapshot from monitor detail
    When I navigate to the "Montage" page
    And I click into the first monitor detail page
    Then I should see the monitor player
    When I click the snapshot button
    Then the snapshot should be saved successfully
