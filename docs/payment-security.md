# Payment verification

The backend requires a valid `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` pair for online payments. Missing or rejected provider credentials never produce a mock order, mock account, or successful verification. `MockPaymentProvider` is restricted to automated tests (`NODE_ENV=test`), including operations on previously constructed instances.

Configure a separate `RAZORPAY_WEBHOOK_SECRET` on the backend and use the same webhook secret in Razorpay. A missing secret returns 503; missing, malformed, or incorrect signatures return 400. Every webhook is authenticated using HMAC-SHA256 over the exact raw request bytes captured by Express before parsing. Reconstructed JSON is not accepted. Keep this verification enabled during provider retries.

Booking checkout confirmation uses the server's stored order and expected amount in paise. A valid checkout HMAC must also correspond to a provider payment with the correct order, amount, currency, and captured status. Invalid callbacks do not downgrade paid bookings. Signed webhook captures must match the stored order and amount; booking IDs in provider notes cannot select a different booking. Cancelled and refunded bookings are not reopened by delayed captures.

Webhook retries are coalesced within one server process and remembered only after successful processing. Booking payment state prevents repeat sequential confirmation. The in-memory event cache is not a durable, cross-worker event ledger.

Linked accounts must be fetched from Razorpay; only provider-reported active accounts become ACTIVE. Existing `acc_mock_` records must complete real provider onboarding before accepting online payments. Account onboarding and order creation fail explicitly when provider requests fail.

The payment security regression tests stub provider requests and exercise production-mode checks without charging cards or contacting Razorpay. Live credentials, webhook delivery, and a real transaction must be verified in the deployment environment.

## Razorpay webhook setup

The public endpoint is `POST https://api.serveq.tech/api/payments/webhook`. It does not require a ServeQ login or Bearer token. Authentication is the `X-Razorpay-Signature` HMAC over the unmodified request body.

1. Generate a secret with `openssl rand -hex 32`. Set it as `RAZORPAY_WEBHOOK_SECRET` in the **backend** environment and restart/redeploy the backend. Keep this separate from the Razorpay API key secret and never expose it through a `VITE_` variable.
2. In the Razorpay Dashboard, select the matching Test or Live mode, open **Settings → Webhooks**, and add the endpoint above. Enter the same secret and enable the webhook.
3. Subscribe to `payment.captured`, `order.paid`, `payment.failed`, and `refund.processed`.
4. Complete a test-mode booking or platform subscription payment. Check the webhook delivery log for HTTP 200 and verify the corresponding booking or subscription in ServeQ. Repeat delivery to confirm the dates and entitlement do not extend again. Test the subscription path with the browser closed before its Checkout verification callback.

The event handlers cover:

| Event | Booking | Platform subscription |
| --- | --- | --- |
| `payment.captured` | Confirms the stored booking order after amount/currency validation | Activates the stored purchase and synchronizes the owner's businesses |
| `order.paid` | Confirms a fully paid stored booking order | Validates the fully paid order and captured payment, then activates the stored purchase |
| `payment.failed` | Marks an unpaid booking failed; does not downgrade a paid booking | Acknowledges the failed attempt without granting or revoking access |
| `refund.processed` | Records the matching full or partial booking refund | No automatic entitlement change; subscription refunds require support review |

These platform subscriptions are one-time Orders API purchases for 30 days. They do not use Razorpay's recurring Subscriptions API or its `subscription.*` events. Unrecognized events and orders are acknowledged without granting access.

Checkout callbacks and subscription webhooks share the same activation function and persisted `SubscriptionOrder.activatedAt`/`expiresAt` dates. Delivering both `payment.captured` and `order.paid`, redelivery, or retrying Checkout verification does not buy another month. A delayed event for an older activated purchase does not replace a newer plan. Purchase ownership and pricing come from the database; provider notes are only cross-checked.

`X-Razorpay-Event-Id` identifies repeated deliveries; a payload hash is used if the header is absent. Successful events are cached within one process, concurrent identical deliveries are coalesced, and processing errors are not cached. Database failures return non-2xx so Razorpay can retry. A subscription event marked with `SERVEQ_BUSINESS_SUBSCRIPTION` that arrives before its purchase is persisted returns 503 for redelivery. Persisted subscription activation dates also protect against repeat activation after a process restart. The event cache itself is not a durable, multi-worker ledger.

If rotating the webhook secret, account for in-flight retries signed with the previous secret before switching. See [Razorpay webhook validation and delivery guidance](https://github.com/razorpay/markdown-docs/blob/master/webhooks/validate-test.md).

Webhooks confirm payments after order creation; they do not fix rejected `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` credentials. Test and live dashboard setup and credentials must be verified separately.
