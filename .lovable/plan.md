# NY Sports Teams Event Section

## What will change
- Rename the homepage section to **NY Sports Teams Events**.
- Include published events marked **Scheduled** as well as those already **Live**.
- Keep Jets, Giants, Knicks, Rangers, Islanders, and Brooklyn Nets events together above **Sports Network Streams**.
- Show a clear **LIVE** badge for active events and an **UPCOMING** badge with the scheduled New York date and time for future events.
- Keep ended events hidden and preserve the current membership access rules.

## Technical details
- Update the existing New York teams stream query to accept `live` and `scheduled` statuses.
- Sort live events first, then future scheduled events by start time.
- Adjust card actions so scheduled events display event information without pretending playback is live.
- Verify the homepage placement, mobile layout, and empty state.
