# Free membership must be linked to PayPal

Free members will no longer get access just by clicking "Choose Free". They must connect their PayPal account first — with no charge — and only then does the free membership turn on.

## What changes for members

1. On the plans page, choosing Free opens PayPal.
2. PayPal asks them to approve a $0.00 recurring agreement for MetsXMFanZone. Nothing is charged, ever, while they stay on Free.
3. After they approve, they come back to the site, the free membership activates, and their PayPal account is now on file.
4. If they cancel or never finish the PayPal step, the free membership is not activated and they are sent back to the plans page.
5. The Free card copy changes from "No payment required" to "PayPal link required — $0 charged", so nobody is surprised.
6. The Member Center shows the PayPal-linked status for free members the same way it does for paid members.

Because their PayPal is already connected, upgrading to Weekly, Monthly, or Yearly later is a single confirmation.

## Technical details

- New edge function `create-paypal-free-link`: authenticated, creates (or reuses) a PayPal billing plan priced at $0.00 USD on a monthly cycle under the existing MetsXMFanZone product, creates a subscription for the signed-in user, writes a `pending` row in `subscriptions` with `plan_type = 'free'`, `amount = 0`, and the PayPal subscription id, then returns the approval URL. Uses the same `returnOrigin` pattern as `create-paypal-order`.
- `verify-paypal-payment` gains handling for `plan_type = 'free'`: activates with `end_date = null`, no payment confirmation email, no new-paid-member admin notification (logs a free activation instead).
- `activate-free-membership` is changed so it can no longer grant free access on its own. It only confirms an already-linked free subscription; direct activation without a PayPal subscription id is rejected.
- `Plans.tsx`: the Free button now calls `create-paypal-free-link` and redirects to the approval URL instead of calling `activate-free-membership`.
- Return path reuses `/payment-success`, which already verifies and routes.
- PayPal logging stays redacted; no order/subscription ids in logs or UI errors.

## Verification

- Sign in as a test member, choose Free, confirm the PayPal approval page shows $0.00 and no charge.
- Confirm cancelling at PayPal leaves the member without free access.
- Confirm a completed link activates free access and shows PayPal linked in the Member Center.
