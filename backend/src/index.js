require("dotenv").config();

const express = require("express");
const cors = require("cors");

const webhookRoutes = require("./routes/webhook");

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
}));

// Parse JSON and urlencoded EXCEPT for Razorpay webhook
app.use((req, res, next) => {
    if (req.path === "/webhook/razorpay") {
        return next(); // raw body will be handled in the route
    }

    express.json()(req, res, () => {
        express.urlencoded({ extended: true })(req, res, next);
    });
});

// Health check
app.get("/", (req, res) => {
    res.json({ status: "WhatsApp Shop is running ✅" });
});

// Routes
app.use("/webhook", webhookRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔗 Render URL: ${process.env.RENDER_EXTERNAL_URL || "Local"}`);
    console.log(`📡 Webhook Path: /webhook`);
});