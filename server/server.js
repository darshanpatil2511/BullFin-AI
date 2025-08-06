import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import Portfolio from './models/Portfolio.js';

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

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});