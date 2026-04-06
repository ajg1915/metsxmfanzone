
## Sweepstakes Prize Wheel Feature

### Database (Migration)
Create 3 tables:
- **`sweepstakes_events`** — Admin-scheduled giveaway windows with start/end times, active toggle
- **`sweepstakes_prizes`** — Prize options per event (name, description, odds weight, content unlock details, icon/color)
- **`sweepstakes_winners`** — Track who won what and when (user_id, prize_id, event_id, won_at)

### Admin Portal
- New **Sweepstakes Management** page under admin sidebar
- Create/edit giveaway events with date/time windows
- Add/remove prizes with configurable odds weights
- View winners list with user info and prize details

### Spin Wheel Component
- Animated spinning wheel using CSS/framer-motion
- Shows only during active giveaway windows
- Triggers on login (checked via auth state change)
- Each user gets ONE spin per event
- Displays prize result with celebration animation

### Integration
- Add check in `useAuth` / login flow to detect active sweepstakes
- Show wheel modal after successful login during active events
- Record winner in database after spin
