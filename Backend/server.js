require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
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
app.get('/api/history', async (req, res) => {
  try {
    // Correctly extract userId from the query string (?userId=...)
    const { userId } = req.query; 

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Missing userId' });
    }

    // Find ONLY the prompts belonging to this user
    const history = await Prompt.find({ userId }).sort({ createdAt: -1 });
    res.json(history);
  } catch (error) {
    console.error("Fetch History Error:", error);
    res.status(500).json({ success: false, message: error.message });
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

app.listen(PORT, () => {
  console.log(`🚀 Backend Server is running on http://localhost:${PORT}`);
});