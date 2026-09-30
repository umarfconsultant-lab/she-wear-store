# She Wear store

A complete small store: storefront, admin dashboard, and order database (a JSON file). No dependencies; needs Node 18 or newer.

## Run on your computer
    ADMIN_PASSWORD=your-password node server.js      (Windows PowerShell: $env:ADMIN_PASSWORD="your-password"; node server.js)
Store: http://localhost:3000   Admin: http://localhost:3000/admin

## Before going live
1. Open public/index.html and change `const WA='923001234567'` to your WhatsApp number (country code, no + or spaces).
2. Choose a long ADMIN_PASSWORD. Admin login is disabled if it is not set.

## Deploy (Render, Railway, Fly.io, or any VPS)
- Build command: none. Start command: `npm start`. Node 18+.
- Environment variables: ADMIN_PASSWORD, and DATA_DIR pointing at a PERSISTENT DISK (e.g. /data).
  Without a persistent disk, products, orders and photos are erased on every deploy.
- Use the host's HTTPS and connect your domain (e.g. shewear.pk) in its dashboard.
- Back up the file DATA_DIR/db.json and the uploads folder regularly.

## Using the admin (/admin)
- Products: add, edit, delete, set price, discount, stock and photo.
- Orders: see every order, message the customer on WhatsApp, set status. Cancelling an order puts the stock back.
- Stock drops automatically when an order is placed, and an out-of-stock style cannot be ordered.

## Not included
Card payments (need a merchant account with a gateway such as Safepay or PayFast), customer accounts, email notifications, and multi-photo galleries. Payment is cash on delivery.
