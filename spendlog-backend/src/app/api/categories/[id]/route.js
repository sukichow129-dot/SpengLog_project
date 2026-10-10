
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Category from "@/models/Category";
import Transaction from "@/models/Transaction";

function errorResponse(message, status = 500) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

// GET /api/categories/:id
export async function GET(request, { params }) {
  try {
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return errorResponse("Invalid category ID", 400);
    }

    const category = await Category.findById(id);

    if (!category) {
      return errorResponse("Category not found", 404);
    }

    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    console.error("GET category error:", error.message);
    return errorResponse("Failed to fetch category");
  }
}

// PATCH /api/categories/:id
export async function PATCH(request, { params }) {
  try {
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return errorResponse("Invalid category ID", 400);
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
      if (!["income", "expense"].includes(body.type)) {
        return errorResponse("Invalid category type", 400);
      }

      // Prevent changing type when existing transactions use this category.
      const used = await Transaction.exists({ categoryId: id });

      if (used) {
        return errorResponse(
          "Cannot change category type while transactions reference it",
          409
        );
      }

      updates.type = body.type;
    }

    if ("color" in body) {
      if (typeof body.color !== "string" || !body.color.trim()) {
        return errorResponse("Color must be a non-empty string", 400);
      }
      updates.color = body.color.trim();
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse("No valid fields provided", 400);
    }

    const category = await Category.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!category) {
      return errorResponse("Category not found", 404);
    }

    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    console.error("PATCH category error:", error.message);
    return errorResponse("Failed to update category");
  }
}

// DELETE /api/categories/:id
export async function DELETE(request, { params }) {
  try {
    await connectDB();

    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return errorResponse("Invalid category ID", 400);
    }

    const category = await Category.findById(id);

    if (!category) {
      return errorResponse("Category not found", 404);
    }

    const used = await Transaction.exists({ categoryId: id });

    if (used) {
      return errorResponse(
        "Reassign or remove transactions using this category first",
        409
      );
    }

    await category.deleteOne();

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("DELETE category error:", error.message);
    return errorResponse("Failed to delete category");
  }
}