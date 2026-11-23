⸻

# 🚀 ServeQ — Smart Queue Booking Platform  
<p align="center">
  <b>Skip the wait. Arrive exactly when it’s your turn.</b><br/>
  <i>Live clinic queues, digital prescriptions, and automatic follow-up reminders</i>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React%20(Vite)-blue?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Backend-Node%20%7C%20Express-green?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Database-MongoDB-brightgreen?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Auth-JWT-orange?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Cloud-AWS%20EC2-orange?style=for-the-badge"/>
  <img src="https://img.shields.io/badge/Hosting-Vercel-black?style=for-the-badge"/>
</p>
<p align="center">
  <a href="YOUR_VERCEL_LINK"><b>🌐 Live Demo</b></a> •
  <a href="YOUR_GITHUB_LINK"><b>📦 Repository</b></a>
</p>
---
## Clinic workflows

- Patients join a live clinic queue or book an appointment and follow their estimated wait from their phone.
- Doctors issue digital prescriptions. Patients can open them in visit history and download a PDF.
- An optional future date on a prescription schedules an in-app reminder at 9 a.m. IST the day before. If the doctor saves it after that time, the worker picks it up on its next run.
- Patients can opt in to WhatsApp follow-up reminders from their profile after verifying their phone number. They can turn reminders off from the same setting.

### Phone verification

Patients can verify their phone number from Profile by requesting a Firebase SMS code. Enable Phone sign-in, add your frontend domain to Firebase Authentication, and allow the countries you serve in the SMS region policy. Use the same Firebase project for the frontend and the backend. [Firebase web phone authentication](https://firebase.google.com/docs/auth/web/phone-auth).

### WhatsApp delivery

Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_FOLLOW_UP_TEMPLATE` on the backend. Use an approved utility template with no variables, for example, “You have an upcoming follow-up. Sign in to serveQ for details.” Set `WHATSAPP_TEMPLATE_LANGUAGE` if the template uses a language other than `en_US`. In-app reminders work independently of the WhatsApp provider. [Meta WhatsApp Cloud API](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/).

## 🏗️ Architecture  
```txt
Client (React + Vite)
        ↓
Frontend (Vercel)
        ↓
REST API (Node.js + Express)
        ↓
MongoDB Database
        ↓
AWS EC2 (Elastic IP)

⸻

🛠️ Tech Stack

Layer	Technology
Frontend	React (Vite), Tailwind CSS
Backend	Node.js, Express.js
Database	MongoDB
Authentication	JWT
Cloud	AWS EC2 (Elastic IP)
Hosting	Vercel

⸻

🌐 Live Demo

Link:https://serveq.tech

⚠️ Note: Backend may be offline if EC2 instance is stopped to avoid cloud costs.

⸻

⚠️ Backend Availability

The backend is deployed on AWS EC2.

If the app is not responding:

* The server is likely stopped intentionally
* Restarting the EC2 instance will bring it back online

⸻

▶️ Run Locally

1️⃣ Clone Repository

git clone https://github.com/your-username/SmartQueue.git
cd serveq

⸻

2️⃣ Backend Setup

cd backend
npm install

Create .env file:

PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key

Run backend:

npm run dev

⸻

3️⃣ Frontend Setup

cd frontend
npm install

Create .env file:

VITE_API_URL=http://localhost:5000

Run frontend:

npm run dev

⸻

☁️ Run Deployed Backend (AWS EC2)

Start Instance

Go to AWS Console → EC2 → Start Instance

Connect via SSH

ssh -i your-key.pem ubuntu@your-elastic-ip

Start Server

cd serveq/backend
npm install
npm start

💡 Recommended: Use pm2 for background process

npm install -g pm2
pm2 start server.js
pm2 save
pm2 startup

⸻

🎯 Problem & Solution

❌ Traditional System

* Long waiting times
* No queue visibility
* Poor customer experience

✅ ServeQ Solution

* Real-time tracking
* Smart scheduling
* Zero unnecessary waiting

⸻

🚀 Future Enhancements

* 🔮 AI-based wait time prediction
* 📲 Push notifications
* 🏪 Multi-business onboarding
* 💳 Payment integration
* 📱 Mobile app (React Native)

⸻

📊 Why This Project Stands Out

✔ Real-world problem solving
✔ Full-stack implementation
✔ Cloud deployment (AWS + Vercel)
✔ Scalable architecture
✔ Production-ready design

⸻

🤝 Contributing

Contributions are welcome!

Fork → Clone → Improve → Pull Request 

⸻

📬 Contact

* LinkedIn: https://linkedin.com/in/ayushman30
* Email: ayushman.rick007@gmail.com

⸻

⭐ Support

If you like this project, give it a ⭐ on GitHub

