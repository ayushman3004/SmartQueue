# ServeQ

[ServeQ](https://serveq.tech) helps patients join clinic queues, book appointments, and see their estimated wait. Clinics can manage bookings and walk-ins in one place, and doctors can issue digital prescriptions.

## Clinic workflows

- **Patients** can join a live queue or book an appointment. They can sign in with email and password, Google, or a WhatsApp code sent to a verified phone number or one recorded at clinic check-in.
- **Clinic teams** can check in walk-ins, manage appointments and the live queue, and record cash or UPI payments. New clinic owners [apply for access](https://serveq.tech/business/apply) before onboarding.
- **Doctors** can manage assigned visits and issue prescriptions. Patients can open and download prescription PDFs from Visit history or **Profile → Saved prescriptions**.
- **Follow-up reminders** are due in the app at 9 a.m. IST the day before the follow-up. If the doctor saves the prescription after that time, the next worker run can deliver the reminder.
- **WhatsApp notices** are optional. Patients can manage separate preferences in Profile for prescription availability and clinic visit notices. Visit notices depend on the clinic's plan and configured templates. Prescription notices contain a link to ServeQ without clinical details. See the [WhatsApp integration guide](docs/whatsapp-integration.md).

## Run locally

Use **Node.js 24.12.0 or newer**, npm, and a MongoDB connection. Use a replica set for booking and clinic onboarding transactions. The sample connection string expects a local replica set named `rs0`. You can also use a MongoDB Atlas connection string.

```sh
git clone https://github.com/ayushman3004/SmartQueue.git serveq
cd serveq
npm ci
cp -n .env.example .env
```

In the root `.env`, set `MONGO_URI` and a strong `JWT_SECRET`. Keep `PORT=3001` and `CLIENT_URL=http://localhost:5173`. Leave `VITE_API_URL` empty to use Vite's REST API and Socket.IO proxy. Use [.env.example](.env.example) for the full list of integration settings.

```sh
npm run dev:all
```

Open [http://localhost:5173](http://localhost:5173). Check [http://localhost:3001/ready](http://localhost:3001/ready) to confirm the API can reach MongoDB. For separate terminals, run `npm run server:dev` for the API and `npm run dev` for the frontend.

Configure the services you need for the workflow you're testing.

| Workflow | Local configuration |
| --- | --- |
| Email verification and recovery | Configure Resend or SMTP using the settings in [.env.example](.env.example). |
| Google sign-in | Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Register `http://localhost:3001/api/auth/google/callback` as a redirect URI. |
| Digital prescriptions | Set `PRESCRIPTION_ENCRYPTION_KEY` to a 32-byte key generated with `openssl rand -hex 32`. Keep the same key for any instance that reads or writes the same encrypted prescriptions. |
| WhatsApp phone verification, sign-in, and notices | Configure Meta WhatsApp Cloud API, Redis or Valkey, and Cloudflare Turnstile using the [WhatsApp integration guide](docs/whatsapp-integration.md). |
| Maps and Razorpay | See the [maps setup guide](docs/location_and_maps_setup.md) and [payment integration notes](docs/payment-security.md). |

## Architecture and deployment

ServeQ is a single npm project. The React, Vite, and Tailwind CSS frontend is hosted on **Vercel** at [serveq.tech](https://serveq.tech). The Express API and Socket.IO server run together on **Render** at [api.serveq.tech](https://api.serveq.tech), using [Dockerfile.backend](Dockerfile.backend) and `npm start`. MongoDB stores application data, and Redis or Valkey supports shared rate limits and WhatsApp jobs. Authentication uses a JWT in an HTTP-only session cookie.

See the [architecture overview](docs/serveq-workflow-architecture.md), [CI/CD and deployment guide](docs/CI-CD.md), and [business admission workflow](docs/business-admission.md) for implementation and operational details.

## Development checks

```sh
npm run ci:frontend
```

This runs lint, tests, the production build, and checks on the generated output. Run `npm run lint`, `npm test`, or `npm run build` individually as needed. The frontend build is written to `dist/`.

## Contributing

Open an issue or pull request in the [GitHub repository](https://github.com/ayushman3004/SmartQueue). For product help, visit [ServeQ support](https://serveq.tech/support).
