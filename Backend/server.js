require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "https://chatbot-ai-silk-ten.vercel.app",
    "http://localhost:3000",
    "https://mychatbotv1.vercel.app"
  ],
  methods: ["GET", "POST", "DELETE", "PUT"],
  credentials: true
}));
app.use(express.json());

// ─── Rate limiting — prevent API spam ────────────────────────────────────────
const saveLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30,              // max 30 saves per minute per IP
  message: { success: false, message: "Too many requests. Please slow down." }
});

// ─── MongoDB connection ───────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10,       // connection pooling — reuses connections
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('🟢 Connected to MongoDB Successfully!'))
  .catch((err) => console.log('🔴 Database connection error:', err));

// reconnect on disconnect
mongoose.connection.on('disconnected', () => {
  console.log('🟡 MongoDB disconnected. Attempting reconnect...');
  mongoose.connect(process.env.MONGO_URI);
});

// ─── Schema ───────────────────────────────────────────────────────────────────
const promptSchema = new mongoose.Schema({
  userId: String,
  title: String,
  userPrompt: String,
  aiResponse: String,
  createdAt: { type: Date, default: Date.now }
});

const Prompt = mongoose.model('Prompt', promptSchema);

// ─── Route: Save a new prompt ─────────────────────────────────────────────────
app.post('/api/save-prompt', saveLimiter, async (req, res) => {
  try {
    const { userId, userPrompt, aiResponse, title } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }

    const newEntry = new Prompt({ userId, title, userPrompt, aiResponse });
    await newEntry.save();

    // FIX: return _id so frontend can use it for instant sidebar update + delete
    res.json({ success: true, _id: newEntry._id });
  } catch (error) {
    console.error("Database Save Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Route: Get history for a user ───────────────────────────────────────────
app.get('/api/history', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const userHistory = await Prompt.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json(userHistory);
  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// ─── Route: Delete ONE chat — must be BEFORE /:userId ────────────────────────
app.delete('/api/history/chat/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid chat ID.' });
    }

    await Prompt.findByIdAndDelete(id);
    res.json({ success: true, message: 'Message deleted!' });
  } catch (error) {
    console.error("Delete Chat Error:", error);
    res.status(500).json({ success: false, message: 'Failed to delete message.' });
  }
});

// ─── Route: Delete ALL history for a user ────────────────────────────────────
app.delete('/api/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }

    await Prompt.deleteMany({ userId });
    res.json({ success: true, message: 'History cleared!' });
  } catch (error) {
    console.error("Clear History Error:", error);
    res.status(500).json({ success: false, message: 'Failed to clear history.' });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/ping', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend Server is live on port ${PORT}`);
});