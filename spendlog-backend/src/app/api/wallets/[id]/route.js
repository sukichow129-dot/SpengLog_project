
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Wallet from "@/models/Wallet";
import Transaction from "@/models/Transaction";

function errorResponse(message, status = 500) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

// GET /api/wallets/:id
export async function GET(request, { params }) {
  try {
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return errorResponse("Invalid wallet ID", 400);
    }

    const wallet = await Wallet.findById(id);

    if (!wallet) {
      return errorResponse("Wallet not found", 404);
    }

    return NextResponse.json({ success: true, data: wallet });
  } catch (error) {
    console.error("GET wallet error:", error.message);
    return errorResponse("Failed to fetch wallet");
  }
}

// PATCH /api/wallets/:id
export async function PATCH(request, { params }) {
  try {
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return errorResponse("Invalid wallet ID", 400);
    }

    const body = await request.json();
    const updates = {};

    if ("name" in body) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return errorResponse("Name cannot be empty", 400);
      }
      updates.name = body.name.trim();
    }

    if ("type" in body) {
      if (!["cash", "bank"].includes(body.type)) {
        return errorResponse("Wallet type must be cash or bank", 400);
      }

      // Avoid changing the wallet type while transactions reference it.
      const used = await Transaction.exists({ walletId: id });

      if (used) {
        return errorResponse(
          "Cannot change wallet type while transactions reference it",
          409
        );
      }

      updates.type = body.type;
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse("No valid fields provided", 400);
    }

    const wallet = await Wallet.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!wallet) {
      return errorResponse("Wallet not found", 404);
    }

    return NextResponse.json({ success: true, data: wallet });
  } catch (error) {
    console.error("PATCH wallet error:", error.message);
    return errorResponse("Failed to update wallet");
  }
}

// DELETE /api/wallets/:id
export async function DELETE(request, { params }) {
  try {
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return errorResponse("Invalid wallet ID", 400);
    }

    const wallet = await Wallet.findById(id);

    if (!wallet) {
      return errorResponse("Wallet not found", 404);
    }

    const used = await Transaction.exists({ walletId: id });

    if (used) {
      return errorResponse(
        "Reassign or remove transactions using this wallet first",
        409
      );
    }

    await wallet.deleteOne();

    return NextResponse.json({
      success: true,
      message: "Wallet deleted successfully",
    });
  } catch (error) {
    console.error("DELETE wallet error:", error.message);
    return errorResponse("Failed to delete wallet");
  }
}