
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Wallet from "@/models/Wallet";
import Transaction from "@/models/Transaction";

function errorResponse(message, status = 500) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

// GET /api/wallets
export async function GET() {
  try {
    await connectDB();

    const wallets = await Wallet.find().sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      data: wallets,
    });
  } catch (error) {
    console.error("GET wallets error:", error.message);
    return errorResponse("Failed to fetch wallets");
  }
}

// POST /api/wallets
export async function POST(request) {
  try {
    await connectDB();

    const body = await request.json();
    const { name, type } = body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !["cash", "bank"].includes(type)
    ) {
      return errorResponse(
        "Name is required and type must be cash or bank",
        400
      );
    }

    const wallet = await Wallet.create({
      name: name.trim(),
      type,
    });

    return NextResponse.json(
      { success: true, data: wallet },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST wallets error:", error.message);

    if (error.name === "ValidationError") {
      return errorResponse("Invalid wallet data", 400);
    }

    return errorResponse("Failed to create wallet");
  }
}