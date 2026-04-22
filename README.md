1. Client Setup (Frontend)
bash# Navigate to client folder
cd D:\Projects\stripe_video\client

# Install dependencies
npm install @stripe/stripe-js react-dom react-router-dom

# Start the client
npm run dev

The client should start on http://localhost:5173 (Vite's default port)

2. Server Setup (Backend)
Open a new terminal and run:
bash# Navigate to server folder
cd D:\Projects\stripe_video\server

# Install dependencies
npm install cors dotenv express nodemon stripe

# Make sure your .env file has your real Stripe key:
# STRIPE_SECRET_KEY=sk_test_51xxxxx...

# Start the server
npm run dev

The server should start on http://localhost:8080
