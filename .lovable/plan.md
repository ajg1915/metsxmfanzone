# Fix NY Sports Team Events

## Changes
- Keep scheduled Jets, Giants, Knicks, Rangers, Islanders, and Brooklyn Nets events visible until an admin marks them live or ended.
- Recognize both full and short team names in event titles and descriptions, including “Jets vs Giants.”
- Preserve explicit team assignments from the admin event form as the primary match.
- Verify the section appears on the homepage with scheduled team events and that the preview remains error-free.

## Technical details
- Update the NY Sports Teams Events filter to stop removing manually controlled scheduled events after their start time.
- Centralize team-name matching so assignment tags and common title formats are handled consistently.
