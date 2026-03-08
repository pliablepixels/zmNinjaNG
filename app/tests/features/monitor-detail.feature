Feature: Monitor Detail Page
  As a ZoneMinder user viewing a monitor
  I want to see and interact with monitor details
  So that I can view live streams and control cameras

  Background:
    Given I am logged into zmNinjaNG
    When I navigate to the "Monitors" page
    And I click into the first monitor detail page

  # ============================================
  # Video Player
  # ============================================

  Scenario: Video player loads and displays stream
    Then I should see the monitor player

  Scenario: Take snapshot from video player
    Then I should see the monitor player
    When I click the snapshot button in monitor detail
    Then I should see snapshot download initiated

  # ============================================
  # Controls Card
  # ============================================

  Scenario: View controls card with all controls
    Then I should see the controls card
    And I should see the alarm toggle in controls card
    And I should see the mode selector in controls card
    And I should see the settings button in controls card

  Scenario: View current monitor mode
    Then I should see the monitor mode dropdown
    And the current mode should be displayed

  Scenario: View alarm status
    Then I should see the alarm status indicator

  # ============================================
  # Settings Dialog
  # ============================================

  Scenario: Open and close settings dialog
    When I click the settings button
    Then I should see the monitor settings dialog
    When I click outside the dialog
    Then the dialog should close

  # ============================================
  # Monitor Navigation
  # ============================================

  Scenario: Navigate between monitors
    Then I should see navigation arrows if multiple monitors exist
    When I click the next monitor button if visible
    Then the monitor should change to next in list

  # Note: Mode change, alarm toggle, rotation, and PTZ tests moved to .wip/
  # These require specific server configuration or hardware to work reliably
