require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ["https://chatbot-ai-silk-ten.vercel.app", "http://localhost:3000", "https://mychatbotv1.vercel.app"],
  methods: ["GET", "POST", "DELETE", "PUT"],
  credentials: true
}));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🟢 Connected to MongoDB Successfully!'))
  .catch((err) => console.log('🔴 Database connection error:', err));

// Blueprint for saving AI Prompts
const promptSchema = new mongoose.Schema({
  userId: String,
  userPrompt: String,
  aiResponse: String,
  createdAt: { type: Date, default: Date.now }
});

const Prompt = mongoose.model('Prompt', promptSchema);

// ─────────────────────────────────────────
// Route: Save a new prompt
// ─────────────────────────────────────────
app.post('/api/save-prompt', async (req, res) => {
  try {
    const { userId, userPrompt, aiResponse } = req.body;

    // FIX: guard against missing userId so we don't save corrupted documents
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }

    console.log("Saving for User:", userId);

    const newEntry = new Prompt({ userId, userPrompt, aiResponse });
    await newEntry.save();
    res.json({ success: true });
  } catch (error) {
    console.error("Database Save Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────
// Route: Get history for a specific user
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// Route: Delete ONE specific chat message
// NOTE: This MUST come before /api/history/:userId
// so Express matches the specific route first.
// ─────────────────────────────────────────
app.delete('/api/history/chat/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // FIX: validate ObjectId before querying to avoid a Mongoose CastError 500
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

// ─────────────────────────────────────────
// Route: Delete ALL history for a specific user
// NOTE: This comes AFTER /api/history/chat/:id
// ─────────────────────────────────────────
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend Server is live and listening on port ${PORT}`);
});