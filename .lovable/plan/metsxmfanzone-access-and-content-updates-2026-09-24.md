# MetsXMFanZone access and content updates

## What will change
- Restore dark, readable text inside the article editors while keeping published article text white.
- Let signed-in admins enter the admin area without a PIN, then fully sign them out after five minutes without activity.
- Extend the existing admin Background Management page so an admin can upload and activate artwork for the login and signup blue areas; both screens will use the selected artwork.
- Add an “Offseason New York Teams” live-stream row above the 24/7 channels for Jets, Giants, Knicks, Rangers, Islanders, and Brooklyn Nets event streams.

## Technical details
- Reuse the existing role check for PIN bypass and reset a five-minute inactivity timer on pointer, keyboard, touch, and scroll activity.
- Reuse the existing R2 upload flow and `background_settings` records rather than introducing a second media system.
- Classify offseason streams from their assigned team/page value or team name, keep them separate from always-on channels, and preserve existing access checks and player routing.
- Verify the editor/article contrast, admin sign-out behavior, auth artwork display, and home-page stream ordering in desktop and mobile-sized previews.
