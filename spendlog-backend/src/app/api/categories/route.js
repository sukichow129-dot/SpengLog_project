
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Category from "@/models/Category";

function errorResponse(message, status = 500) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

// GET /api/categories
export async function GET() {
  try {
    await connectDB();

    const categories = await Category.find().sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("GET categories error:", error.message);
    return errorResponse("Failed to fetch categories");
  }
}

// POST /api/categories
export async function POST(request) {
  try {
    await connectDB();

    const body = await request.json();
    const { name, type, color } = body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !["income", "expense"].includes(type)
    ) {
      return errorResponse(
        "Name is required and type must be income or expense",
        400
      );
    }

    const category = await Category.create({
      name: name.trim(),
      type,
      ...(color !== undefined ? { color } : {}),
    });

    return NextResponse.json(
      { success: true, data: category },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST categories error:", error.message);

    if (error.name === "ValidationError") {
      return errorResponse("Invalid category data", 400);
    }

    return errorResponse("Failed to create category");
  }
}
