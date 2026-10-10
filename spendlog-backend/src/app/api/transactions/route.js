
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Transaction from "@/models/Transaction";
import Category from "@/models/Category";
import Wallet from "@/models/Wallet";

function errorResponse(message, status = 500) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

// GET /api/transactions
export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type");
    const categoryId = searchParams.get("categoryId");
    const walletId = searchParams.get("walletId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      return errorResponse(
        "Page must be positive and limit must be between 1 and 100",
        400
      );
    }

    const filter = {};

    if (type) {
      if (!["income", "expense"].includes(type)) {
        return errorResponse(
          "Type must be income or expense",
          400
        );
      }

      filter.type = type;
    }

    if (categoryId) {
      if (!mongoose.isValidObjectId(categoryId)) {
        return errorResponse("Invalid category ID", 400);
      }

      filter.categoryId = categoryId;
    }

    if (walletId) {
      if (!mongoose.isValidObjectId(walletId)) {
        return errorResponse("Invalid wallet ID", 400);
      }

      filter.walletId = walletId;
    }

    if (startDate || endDate) {
      filter.date = {};

      if (startDate) {
        const start = new Date(startDate);

        if (Number.isNaN(start.getTime())) {
          return errorResponse("Invalid startDate", 400);
        }

        filter.date.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);

        if (Number.isNaN(end.getTime())) {
          return errorResponse("Invalid endDate", 400);
        }

        filter.date.$lte = end;
      }

      if (
        startDate &&
        endDate &&
        new Date(startDate) > new Date(endDate)
      ) {
        return errorResponse(
          "startDate cannot be after endDate",
          400
        );
      }
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate("categoryId")
        .populate("walletId")
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Transaction.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET transactions error:", error.message);
    return errorResponse("Failed to fetch transactions");
  }
}

// POST /api/transactions
export async function POST(request) {
  try {
    await connectDB();

    const body = await request.json();

    const {
      type,
      amountSatang,
      date,
      categoryId,
      walletId,
      note,
    } = body;

    if (!["income", "expense"].includes(type)) {
      return errorResponse(
        "Type must be income or expense",
        400
      );
    }

    if (
      !Number.isSafeInteger(amountSatang) ||
      amountSatang <= 0
    ) {
      return errorResponse(
        "amountSatang must be a positive integer",
        400
      );
    }

    if (
      typeof date !== "string" ||
      Number.isNaN(Date.parse(date))
    ) {
      return errorResponse(
        "A valid date is required",
        400
      );
    }

    if (
      !mongoose.isValidObjectId(categoryId) ||
      !mongoose.isValidObjectId(walletId)
    ) {
      return errorResponse(
        "Valid categoryId and walletId are required",
        400
      );
    }

    const [category, wallet] = await Promise.all([
      Category.findById(categoryId),
      Wallet.findById(walletId),
    ]);

    if (!category) {
      return errorResponse("Category not found", 404);
    }

    if (!wallet) {
      return errorResponse("Wallet not found", 404);
    }

    if (category.type !== type) {
      return errorResponse(
        "Transaction type must match category type",
        400
      );
    }

    const transaction = await Transaction.create({
      type,
      amountSatang,
      date: new Date(date),
      categoryId,
      walletId,
      note: typeof note === "string" ? note : "",
    });

    const result = await Transaction.findById(
      transaction._id
    )
      .populate("categoryId")
      .populate("walletId");

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST transaction error:", error.message);

    if (error.name === "ValidationError") {
      return errorResponse("Invalid transaction data", 400);
    }

    return errorResponse("Failed to create transaction");
  }
}