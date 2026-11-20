# FSDP_C30

Centralised administrative system for Aikido Shinjukai centres. It covers students, instructors, classes, terms, grading, fees, Stripe payments, email notifications and financial reports.

## Stack

- Backend: Node.js, Express 5, PostgreSQL (`pg`), Joi validation, bcrypt, Stripe, Resend, pdfkit.
- Frontend: React, Vite, Tailwind CSS v4 (in `public/`).

## Setup

1. Install dependencies: `npm install` and `npm --prefix public install`.
2. Create a `.env` file in the project root (see the table below).
3. Load `FullStackDatabase.sql` into PostgreSQL.
4. Optional: `npm run seed` loads demo data. It is safe to run more than once.
5. Start with `npm run dev`. The API and client run together.

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string (`dbConfig.js`). |
| `AUTH_SECRET` | Recommended | Signs session cookies. If unset, a random value is used and sessions reset on restart. |
| `PORT` | No | HTTP port, default `3000`. |
| `APP_BASE_URL` | No | Base URL for Stripe Checkout redirects, default `http://localhost:3000`. |
| `STRIPE_SECRET_KEY` | For payments | Stripe API key (test mode in development). |
| `STRIPE_WEBHOOK_SECRET` | For payments | Signing secret from `stripe listen` or the dashboard. |
| `RESEND_API_KEY` | For email | Enables email sending. Without it, sends are skipped. |
| `RESEND_FROM` | No | Sender address. Needs a verified domain to reach students. The default `onboarding@resend.dev` only delivers to the Resend account owner. |
| `REMINDER_JOB` | No | Set to `off` to disable the daily reminder timer. |
| `NODE_ENV` | No | Set to `production` to send cookies over HTTPS only. |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API (nodemon) and the Vite client. |
| `npm run appStart` | Starts only the API. |
| `npm run client:build` | Builds the client. |
| `npm run seed` | Loads all demo data (centres, classes, instructors, students, payments, gradings). Safe to re-run. |
| `npm run migrate` | Applies pending files in `migrations/` once each, tracked in `schema_migrations`. |
| `npm test` | Runs unit tests in `tests/` with the built-in Node test runner. |

## Demo logins

There is one login form. The server returns the account's role and the app sends admins to `/admin/dashboard` and students to `/student`.

- Admin: `admin@as.com` / `Admin@12345`
- Admin (second account): `sensei@as.com` / `Admin@12345`
- Student: `student@gmail.com` / `Student@12345`
- Sample students: `alice.tan@example.com`, `ben.lim@example.com`, `chloe.ng@example.com`, `daniel.ong@example.com`, `eliza.koh@example.com`, `farid.ismail@example.com`, ... all with `Student@12345`.

## Stripe webhook (local)

Run this in a separate terminal while testing payments:

```
stripe listen --forward-to localhost:3000/api/billing/webhook --all-snapshot
```

Copy the `whsec_` value it prints into `STRIPE_WEBHOOK_SECRET`. The value changes each time the listener restarts.

## Folder layout

- `app.js`: Express setup, route mounting, raw-body webhook route, reminder timer.
- `dbConfig.js`: PostgreSQL pool.
- `routes/`: URL paths and middleware per feature.
- `controllers/`: request validation and HTTP responses.
- `model/`: SQL queries.
- `services/`: Stripe, email and reminder logic.
- `middlewares/`: session cookies, admin checks and centre filters.
- `public/`: React client (`src/pages`, `src/components`).
- `scripts/seed.js`: all demo data, inlined in one file.
- `scripts/migrate.js`: applies `migrations/*.sql` in order.
- `tests/`: unit tests.
- `FullStackDatabase.sql`: schema source of truth.

## Testing

`npm test` covers the pure report helpers: date bounds for the financial report and CSV cell escaping. Database and Stripe flows were checked by hand against a running server.