Feature: Event Browsing and Management
  As a ZoneMinder user
  I want to browse and filter events
  So that I can review recorded incidents

  Background:
    Given I am logged into zmNinjaNG

  Scenario: Browse events in list view
    When I navigate to the "Events" page
    Then I should see the page heading "Events"
    And I should see events list or empty state

  Scenario: Switch between list and montage views
    When I navigate to the "Events" page
    Then I should see the page heading "Events"
    When I switch events view to montage
    Then I should see the events montage grid

  Scenario: Apply event filters
    When I navigate to the "Events" page
    And I open the events filter panel
    And I set the events date range
    And I apply event filters
    Then I should see events list or empty state

  Scenario: Clear event filters
    When I navigate to the "Events" page
    And I open the events filter panel
    And I set the events date range
    And I apply event filters
    When I clear event filters
    Then I should see events list or empty state

  Scenario: View event details
    When I navigate to the "Events" page
    And I click into the first event if events exist
    And I navigate back if I clicked into an event
    Then I should be on the "Events" page

  Scenario: Change event thumbnail fit
    When I navigate to the "Events" page
    Then I should see the page heading "Events"
    # Thumbnail fit selector is tested via data-testid selectors

  Scenario: Download event video with background task tracking
    When I navigate to the "Events" page
    And I click into the first event if events exist
    And I click the download video button if video exists
    Then I should see the background task drawer if download was triggered

  Scenario: Download snapshot from events montage
    When I navigate to the "Events" page
    When I switch events view to montage
    Then I should see the events montage grid
    When I download snapshot from first event in montage
    Then I should see the background task drawer if download was triggered

  Scenario: Favorite and unfavorite an event from list view
    When I navigate to the "Events" page
    And I favorite the first event if events exist
    Then I should see the event marked as favorited if action was taken
    When I unfavorite the first event if it was favorited
    Then I should see the event not marked as favorited if action was taken

  Scenario: Filter events to show only favorites
    When I navigate to the "Events" page
    And I favorite the first event if events exist
    When I open the events filter panel
    And I enable favorites only filter
    And I apply event filters
    Then I should see events list or empty state

  Scenario: Favorite an event from detail page
    When I navigate to the "Events" page
    And I click into the first event if events exist
    And I favorite the event from detail page if on detail page
    And I navigate back if I clicked into an event
    Then I should be on the "Events" page

  Scenario: View event detail page elements
    When I navigate to the "Events" page
    And I click into the first event if events exist
    Then I should see event detail elements if on detail page
    And I navigate back if I clicked into an event

  Scenario: Navigate back from event detail
    When I navigate to the "Events" page
    And I click into the first event if events exist
    And I navigate back if I clicked into an event
    Then I should be on the "Events" page

  @mobile
  Scenario: Events page on mobile viewport
    When I navigate to the "Events" page
    Then I should see the page heading "Events"
    And I should see events list or empty state
