import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import getGridFSBucket from "@/lib/gridfs";
import Transaction from "@/models/Transaction";
import Category from "@/models/Category";
import Wallet from "@/models/Wallet";

function errorResponse(message, status = 500) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

async function getTransaction(id) {
  return Transaction.findById(id)
    .populate("categoryId")
    .populate("walletId");
}

// GET /api/transactions/:id
export async function GET(request, { params }) {
  try {
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return errorResponse("Invalid transaction ID", 400);
    }

    const transaction = await getTransaction(id);

    if (!transaction) {
      return errorResponse("Transaction not found", 404);
    }

    return NextResponse.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("GET transaction error:", error.message);
    return errorResponse("Failed to fetch transaction");
  }
}

// PATCH /api/transactions/:id
export async function PATCH(request, { params }) {
  try {
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return errorResponse("Invalid transaction ID", 400);
    }

    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return errorResponse("Transaction not found", 404);
    }

    const body = await request.json();

    const allowedFields = [
      "type",
      "amountSatang",
      "date",
      "categoryId",
      "walletId",
      "note",
    ];

    const hasAllowedField = allowedFields.some(
      (field) => Object.hasOwn(body, field)
    );

    if (!hasAllowedField) {
      return errorResponse("No valid fields provided", 400);
    }

    const nextType = body.type ?? transaction.type;
    const nextCategoryId =
      body.categoryId ?? transaction.categoryId.toString();
    const nextWalletId =
      body.walletId ?? transaction.walletId.toString();

    if (!["income", "expense"].includes(nextType)) {
      return errorResponse("Type must be income or expense", 400);
    }

    if (Object.hasOwn(body, "amountSatang")) {
      if (
        !Number.isSafeInteger(body.amountSatang) ||
        body.amountSatang <= 0
      ) {
        return errorResponse(
          "amountSatang must be a positive integer",
          400
        );
      }

      transaction.amountSatang = body.amountSatang;
    }

    if (Object.hasOwn(body, "date")) {
      if (
        typeof body.date !== "string" ||
        Number.isNaN(Date.parse(body.date))
      ) {
        return errorResponse("Invalid date", 400);
      }

      transaction.date = new Date(body.date);
    }

    if (!mongoose.isValidObjectId(nextCategoryId)) {
      return errorResponse("Invalid category ID", 400);
    }

    if (!mongoose.isValidObjectId(nextWalletId)) {
      return errorResponse("Invalid wallet ID", 400);
    }

    const [category, wallet] = await Promise.all([
      Category.findById(nextCategoryId),
      Wallet.findById(nextWalletId),
    ]);

    if (!category) {
      return errorResponse("Category not found", 404);
    }

    if (!wallet) {
      return errorResponse("Wallet not found", 404);
    }

    if (category.type !== nextType) {
      return errorResponse(
        "Transaction type must match category type",
        400
      );
    }

    if (!["cash", "bank"].includes(wallet.type)) {
      return errorResponse("Invalid wallet type", 400);
    }

    if (Object.hasOwn(body, "note")) {
      if (typeof body.note !== "string") {
        return errorResponse("Note must be a string", 400);
      }

      transaction.note = body.note;
    }

    transaction.type = nextType;
    transaction.categoryId = nextCategoryId;
    transaction.walletId = nextWalletId;

    await transaction.save();

    const updated = await getTransaction(id);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("PATCH transaction error:", error.message);

    if (error.name === "ValidationError") {
      return errorResponse("Invalid transaction data", 400);
    }

    return errorResponse("Failed to update transaction");
  }
}

// DELETE /api/transactions/:id
export async function DELETE(request, { params }) {
  try {
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return errorResponse("Invalid transaction ID", 400);
    }

    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return errorResponse("Transaction not found", 404);
    }

    // Delete the receipt first, if the transaction has one.
    if (transaction.receiptFileId) {
      const bucket = await getGridFSBucket();

      try {
        await bucket.delete(transaction.receiptFileId);
      } catch (error) {
        console.error("Receipt cleanup failed:", error);

        // Keep the transaction if its receipt could not be deleted.
        return errorResponse(
          "Could not delete the transaction receipt",
          500
        );
      }
    }

    await transaction.deleteOne();

    return NextResponse.json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    console.error("DELETE transaction error:", error.message);
    return errorResponse("Failed to delete transaction");
  }
}
