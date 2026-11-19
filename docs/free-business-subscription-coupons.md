# Free Pro business coupons

In Admin → Businesses, select **Inspect** for an approved business. The **Free Pro subscription coupon** panel contains **Generate & email free Pro coupon**. It uses the saved business email, not an address supplied by the browser. A business email and registered owner are required; the owner can complete invitation activation after the coupon is issued.

The code starts with the business name, for example `JALANDHAR-CLINIC-PRO-<random suffix>`. Each business receives one initial coupon. It can be redeemed once for **Pro for 30 days at ₹0**, beginning at redemption. The owner has 90 days from issuance to redeem it. It does not create a Razorpay order, charge a card, enable automatic renewal, or bypass payment signatures. Standard paid subscriptions still use real Razorpay verification.

The email links to `/subscription` without placing the coupon in the URL. After signing in with the approved owner account, enter the emailed code in **Have a free Pro coupon?** The coupon is bound to the business and its issued owner; another account cannot redeem it. Existing active subscriptions must expire before redemption, so a free grant cannot replace paid time. The grant is scoped to the named business, including backend subscription and AI analytics eligibility checks.

Generation and resending use the same coupon record, protected by unique business and code indexes. Double-clicks cannot create additional coupons. Email attempts have a one-minute cooldown and a short delivery lease. The panel displays delivery failure and offers **Resend coupon email** after the cooldown. Once activated, the panel shows the expiry and disables further issue/redemption. Redeemed records are retained; there is no TTL deletion that would reset eligibility.

Redemption consumes the coupon and updates both the business and owner entitlement in one MongoDB transaction. Concurrent redemptions cannot add another month. A failed transaction leaves the coupon available for a safe retry. If a request times out after commit, refresh the subscription status before retrying; an already redeemed code returns a conflict rather than adding more time.

## Render configuration

- Configure `RESEND_API_KEY` with the verified sender domain, or configure the existing SMTP transporter. `EMAIL_SECURITY_FROM` controls the current mail helper's sender and `EMAIL_SUPPORT` its reply address. Razorpay keys do not configure email delivery.
- Set `CLIENT_URL=https://serveq.tech` (or your actual HTTPS frontend origin).
- Use the existing transaction-capable MongoDB deployment, such as Atlas. Startup builds this collection's unique indexes, including when automatic indexing is disabled. Index or database failures stop startup rather than accepting duplicate initial coupons.
- Keep live `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` for paid flows. No payment secrets are needed to redeem a free coupon and no live transaction is performed by coupon tests.

Tests exercise HTTP authorization, server-controlled plan/price/recipient, duplicate issuance, delivery failure/resending, single and concurrent redemption, rollback/retry, paid subscription protection, and business scope using provider and transactional database fixtures. Live email delivery and Atlas transaction behavior still require deployment verification.
