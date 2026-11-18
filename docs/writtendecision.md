# Technical decisions

Short records of the spikes from Sprint 1. Each one lists the options we looked at, what we chose and why.

## AS-56 Email provider

**Question:** Which service should send reminder, receipt and promotion emails?

**Options considered**

- Resend: hosted email API with an official Node.js package.
- SendGrid: hosted email API, more setup (account verification, API key scopes).
- Nodemailer with a Gmail account (SMTP): no extra service, but Gmail limits and blocks automated sending, and needs an app password.

**Decision:** Resend.

**Why**

- One small package (`resend`) and a single function call to send an email.
- The free plan is enough for a prototype and a demo.
- All sending goes through one file, `services/emailService.js`, so switching to SendGrid later only changes that file.

**How it works in our code**

- If `RESEND_API_KEY` is not set, nothing is sent. The attempt is still written to `notification_log` as FAILED with the reason, so the log shows what would have gone out.
- Every attempt is logged in `notification_log`. A UNIQUE `dedupe_key` stops the same email being sent twice.
- Resend returns `{ data, error }` instead of throwing, so the code checks `error`.

**Limitation:** The default sender `onboarding@resend.dev` only delivers to the Resend account owner. Sending to students needs a verified domain in `RESEND_FROM`.

## AS-57 Scheduled-job approach

**Question:** How should the daily payment reminders and overdue notices run?

**Options considered**

- `setInterval` inside the Express server (`app.js`): no extra package or service.
- `node-cron`: cron-style schedules, one extra package.
- BullMQ: proper job queue with retries, but needs a Redis server.
- Supabase `pg_cron`: runs inside the database, but email sending lives in our Node code, not in the database.

**Decision:** A daily `setInterval` timer in `app.js`, plus a manual run endpoint.

**Why**

- No extra infrastructure. BullMQ would need Redis, which is too much for a two-week prototype.
- The reminder job only needs to run once a day, so exact cron timing is not important.
- Repeated runs are safe: each reminder has a `dedupe_key` (for example `reminder:<invoice_id>:3d`), so running the job twice never sends the same reminder twice.

**How it works in our code**

- `app.js` calls `runReminders()` from `services/reminderService.js` once every 24 hours. `.unref()` lets the server shut down normally.
- Set `REMINDER_JOB=off` in `.env` to turn the timer off during development.
- Admins can run the job on demand with `POST /api/notifications/run`, which is also how we trigger it during the demo.

**Limitation:** The timer restarts its 24-hour count whenever the server restarts, and it only runs while the server is running. For production we would move to `node-cron` or a hosted scheduler.
