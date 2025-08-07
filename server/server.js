// ----------------------------
// BullFin-AI Express Server
// ----------------------------
// - Loads environment variables
// - Connects to MongoDB via Mongoose
// - Defines API routes for:
//    • Health check
//    • CSV portfolio upload
//    • Financial metrics proxy
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import Portfolio from './models/Portfolio.js';
import fetch from 'node-fetch'; 

dotenv.config();
console.log('Loaded MONGODB_URI:', process.env.MONGODB_URI);
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Health-check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// CSV upload & saving to MongoDB
const upload = multer({ dest: 'uploads/' });

app.post('/api/upload-portfolio', upload.single('file'), (req, res) => {
  // Ensure a file was uploaded under the "file" field
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded; ensure form-data key is "file".'
    });
  }
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', data => results.push(data))
    .on('end', async () => {
      fs.unlinkSync(req.file.path);
      try {
        const docs = results.map(row => ({
          symbol: row.symbol,
          shares: Number(row.shares),
          purchasePrice: Number(row.purchasePrice),
          date: new Date(row.date),
        }));
        const saved = await Portfolio.insertMany(docs);
        res.json({ inserted: saved.length, data: saved });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
});

// ----------------------------
// Proxy to Flask metrics service
// ----------------------------
app.post('/api/metrics', async (req, res) => {
  // Expect portfolio array in request body
  if (!req.body.portfolio) {
    return res.status(400).json({ error: 'Missing portfolio data.' });
  }
  try {
    const response = await fetch('http://127.0.0.1:5000/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolio: req.body.portfolio }),
    });
    const data = await response.json();
    // Attach original portfolio for frontend price lookups
    data.portfolio = req.body.portfolio;
    res.status(response.ok ? 200 : response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// Start Express Server
// ----------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});