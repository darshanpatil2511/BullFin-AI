import mongoose from 'mongoose';

const portfolioSchema = new mongoose.Schema({
  symbol:        { type: String, required: true },
  shares:        { type: Number, required: true },
  purchasePrice: { type: Number, required: true },
  date:          { type: Date,   required: true },
});

// Use the “BullFinAI” database’s “aiproject” collection:
export default mongoose.model('Portfolio', portfolioSchema, 'aiproject');