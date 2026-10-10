import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import getGridFSBucket from "@/lib/gridfs";
import Transaction from "@/models/Transaction";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function errorResponse(message, status = 500) {
  return Response.json(
    { success: false, message },
    { status }
  );
}

// PUT /api/transactions/:id/receipt
// Upload or replace a receipt.
export async function PUT(request, { params }) {
  let newFileId = null;

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

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return errorResponse(
        "Please upload a receipt image using the file field",
        400
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return errorResponse(
        "File must be between 1 byte and 5 MB",
        400
      );
    }

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      return errorResponse(
        "Only JPEG and PNG images are allowed",
        400
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    const isPng =
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );

    if (
      (file.type === "image/jpeg" && !isJpeg) ||
      (file.type === "image/png" && !isPng)
    ) {
      return errorResponse(
        "The uploaded file is not a valid JPEG or PNG image",
        400
      );
    }

    const bucket = await getGridFSBucket();

    const uploadStream = bucket.openUploadStream(
      file.name || "receipt",
      {
        contentType: file.type,
        metadata: {
          contentType: file.type,
          originalName: file.name || "receipt",
        },
      }
    );

    newFileId = uploadStream.id;

    await new Promise((resolve, reject) => {
      uploadStream.once("finish", resolve);
      uploadStream.once("error", reject);
      uploadStream.end(buffer);
    });

    const oldFileId = transaction.receiptFileId;

    transaction.receiptFileId = newFileId;
    await transaction.save();

    if (oldFileId) {
      try {
        await bucket.delete(oldFileId);
      } catch (error) {
        console.error("Old receipt cleanup failed:", error);
      }
    }

    return Response.json({
      success: true,
      message: "Receipt uploaded successfully",
      receiptFileId: newFileId.toString(),
    });
  } catch (error) {
    if (newFileId) {
      try {
        const bucket = await getGridFSBucket();
        await bucket.delete(newFileId);
      } catch (cleanupError) {
        console.error("New receipt cleanup failed:", cleanupError);
      }
    }

    console.error("Receipt upload failed:", error);
    return errorResponse("Failed to upload receipt");
  }
}

// GET /api/transactions/:id/receipt
// Retrieve a receipt image.
export async function GET(request, { params }) {
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

    if (!transaction.receiptFileId) {
      return errorResponse("Receipt not found", 404);
    }

    const bucket = await getGridFSBucket();

    const files = await bucket
      .find({ _id: transaction.receiptFileId })
      .toArray();

    if (files.length === 0) {
      return errorResponse("Receipt file not found", 404);
    }

    const file = files[0];
    const downloadStream = bucket.openDownloadStream(file._id);
    const chunks = [];

    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }

    const imageBuffer = Buffer.concat(chunks);
    const contentType =
      file.metadata?.contentType ||
      file.contentType ||
      "application/octet-stream";

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(imageBuffer.length),
        "Content-Disposition": 'inline; filename="receipt"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Receipt retrieval failed:", error);
    return errorResponse("Failed to retrieve receipt");
  }
}

// DELETE /api/transactions/:id/receipt
// Delete only the receipt, not the transaction.
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

    if (!transaction.receiptFileId) {
      return errorResponse("Receipt not found", 404);
    }

    const bucket = await getGridFSBucket();
    const receiptFileId = transaction.receiptFileId;

    // Remove the reference first, so the transaction remains usable
    // even if GridFS cleanup fails.
    transaction.receiptFileId = undefined;
    await transaction.save();

    try {
      await bucket.delete(receiptFileId);
    } catch (error) {
      console.error("Receipt cleanup failed:", error);

      return errorResponse(
        "Receipt reference was removed, but file cleanup failed",
        500
      );
    }

    return Response.json({
      success: true,
      message: "Receipt deleted successfully",
    });
  } catch (error) {
    console.error("Receipt deletion failed:", error);
    return errorResponse("Failed to delete receipt");
  }
}
