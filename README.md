# DeliveredAI

On-demand delivery and dispatch for businesses. Customers book a car, SUV, pickup, cargo van or box truck; orders go into a driver pool; drivers claim, pick up and deliver; a master admin CRM sees everything.

## Stack

- **API:** Node 22+, Express 5, SQLite through the built-in `node:sqlite` (no database server to install)
- **Web:** React 18 + Vite + React Router
- **Auth:** scrypt-hashed passwords, JWT in an httpOnly SameSite cookie, role-based access (`customer`, `driver`, `admin`)

## Run it

```bash
npm run install:all     # install server and web dependencies
npm run seed            # optional: demo customer, driver and orders
npm run dev             # API on :4000, web on http://localhost:5173
```

Production (one process serves the API and the built frontend):

```bash
npm run build
NODE_ENV=production JWT_SECRET=... ADMIN_PASSWORD=... npm start   # http://localhost:4000
```

Tests: `npm test` (API integration tests covering auth, accounts, the order lifecycle, the driver pool and the CRM).

## Accounts

| Who | Login | Notes |
| --- | --- | --- |
| Master admin (CRM) | `crm` | Username set by `ADMIN_USERNAME` (default `crm`). Password from `ADMIN_PASSWORD`; in development it defaults to `crm-dev-password`. Created on first boot. Change it under Account → Password. |
| Demo customer | `customer@demo.deliveredai.com` / `demo12345` | From `npm run seed` |
| Demo driver | `driver@demo.deliveredai.com` / `demo12345` | From `npm run seed` |

See `.env.example` for all settings.

## What's included

- **Marketing site:** landing page with a live instant quote, vehicle pricing, how it works, driver recruiting
- **Signup and login:** business signup, driver signup with vehicle details, login for every role
- **Account:** profile, password change, saved addresses, cards on file, vehicle (drivers), close account
- **Customers:** book now or scheduled, live price breakdown, order history, order detail with live status, cancel, shareable tracking link
- **Public tracking:** `/track/<code>` with no login, showing only non-sensitive fields
- **Driver pool:** online/offline toggle, open jobs filtered to what the driver's vehicle can carry, claim (race-safe), step-by-step status, proof of delivery, earnings
- **CRM (master admin):** overview metrics, all orders with manual dispatch, signups feed, drivers, customers, every quote with conversion, API activity log, CSV export of every table

## Stubs to replace before launch

- **Distance:** `server/src/pricing.js` estimates miles deterministically from the addresses. Swap `estimateDistanceMiles` for a Google/Mapbox routing call.
- **Payments:** cards are Luhn-checked and only brand + last 4 are stored; nothing is charged. Replace with Stripe (store the payment method token).
- **Notifications:** no SMS/email yet.

## Layout

```
server/src
  app.js            Express app, API logger, static hosting
  db.js             schema (users, driver_profiles, addresses, payment_methods, orders, order_events, quotes, api_logs)
  pricing.js        vehicles, quotes
  routes/           auth, account, orders (+ public quotes/tracking), driver, admin (CRM)
web/src
  pages/            Landing, Login, Signup, DriverSignup, Dashboard, NewOrder, OrderDetail, Track, Account, DriverHome, DriverJob, Admin
```
