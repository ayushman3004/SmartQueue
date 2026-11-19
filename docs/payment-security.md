# Payment verification

The backend requires a valid `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` pair for online payments. Missing or rejected provider credentials never produce a mock order, mock account, or successful verification. `MockPaymentProvider` is restricted to automated tests (`NODE_ENV=test`), including operations on previously constructed instances.

Configure a separate `RAZORPAY_WEBHOOK_SECRET` on the backend and use the same webhook secret in Razorpay. A missing secret returns 503; missing, malformed, or incorrect signatures return 400. Every webhook is authenticated using HMAC-SHA256 over the exact raw request bytes captured by Express before parsing. Reconstructed JSON is not accepted. Keep this verification enabled during provider retries.

Booking checkout confirmation uses the server's stored order and expected amount in paise. A valid checkout HMAC must also correspond to a provider payment with the correct order, amount, currency, and captured status. Invalid callbacks do not downgrade paid bookings. Signed webhook captures must match the stored order and amount; booking IDs in provider notes cannot select a different booking. Cancelled and refunded bookings are not reopened by delayed captures.

Webhook retries are coalesced within one server process and remembered only after successful processing. Booking payment state prevents repeat sequential confirmation. The in-memory event cache is not a durable, cross-worker event ledger.

Linked accounts must be fetched from Razorpay; only provider-reported active accounts become ACTIVE. Existing `acc_mock_` records must complete real provider onboarding before accepting online payments. Account onboarding and order creation fail explicitly when provider requests fail.

The payment security regression tests stub provider requests and exercise production-mode checks without charging cards or contacting Razorpay. Live credentials, webhook delivery, and a real transaction must be verified in the deployment environment.
