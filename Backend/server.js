require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// This allows ANY Vercel deployment to access your history
app.use(cors({
  origin: ["https://chatbot-ai-silk-ten.vercel.app", "https://mychatbotv1.vercel.app"],
  methods: ["GET", "POST", "DELETE"],
  credentials: true
}));
app.use(express.json()); 

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🟢 Connected to MongoDB Successfully!'))
  .catch((err) => console.log('🔴 Database connection error:', err));

// Blueprint for saving your AI Prompts
const promptSchema = new mongoose.Schema({
  userId: String, // Ensure this matches your frontend data
  userPrompt: String,
  aiResponse: String,
  createdAt: { type: Date, default: Date.now }
});

const Prompt = mongoose.model('Prompt', promptSchema);

// Route: Save a new prompt
app.post('/api/save-prompt', async (req, res) => {
  try {
    const { userId, userPrompt, aiResponse } = req.body;
    console.log("Saving for User:", userId); 

    const newEntry = new Prompt({ userId, userPrompt, aiResponse });
    await newEntry.save();
    res.json({ success: true });
  } catch (error) {
    console.error("Database Save Error:", error); 
    res.status(500).json({ success: false , message:error.message});
  }
});

// Route: Get history for a specific user
// Make sure your Model is imported!
// const Chat = require("./models/Chat"); // or wherever your schema is

// Route: Get history for a specific user
app.get('/api/history', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // ✅ CHANGE THIS: Use 'Prompt' (your model name) instead of 'Chat'
    const userHistory = await Prompt.find({ userId }).sort({ createdAt: -1 });
    
    res.status(200).json(userHistory);
  } catch (error) {
    console.error("Backend Error:", error); 
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});
// Route: Delete all history for a specific user
app.delete('/api/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await Prompt.deleteMany({ userId });
    res.json({ success: true, message: 'History cleared!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to clear history.' });
  }
});
// Route: Delete ONE specific chat message
app.delete('/api/history/chat/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Prompt.findByIdAndDelete(id);
    res.json({ success: true, message: 'Message deleted!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete message.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend Server is live and listening on port ${PORT}`);
});