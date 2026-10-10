
import mongoose from "mongoose";

const WalletSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["cash", "bank"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Wallet =
  mongoose.models.Wallet ||
  mongoose.model("Wallet", WalletSchema);

export default Wallet;
