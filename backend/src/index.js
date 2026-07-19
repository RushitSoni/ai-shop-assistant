require('dotenv').config();
const express = require('express');
const webhookRoutes = require('./routes/webhook');


const cors = require("cors");

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
}));

app.use(express.json());

// Parse JSON and urlencoded EXCEPT for razorpay webhook
app.use((req, res, next) => {
  if (req.path === '/webhook/razorpay') {
    next(); // skip body parsing — raw handler in route will handle it
  } else {
    express.json()(req, res, () => {
      express.urlencoded({ extended: false })(req, res, next);
    });
  }
});

// Health check
app.get('/', (req, res) => res.json({ status: 'WhatsApp Shop is running ✅' }));

// Routes
app.use('/webhook', webhookRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:3000/webhook`);
});