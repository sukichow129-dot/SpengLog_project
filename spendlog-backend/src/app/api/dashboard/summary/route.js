
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Transaction from "@/models/Transaction";

function errorResponse(message, status = 500) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

// Convert a calendar date in Bangkok to its UTC instant.
function bangkokDateToUTC(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, -7, 0, 0));
}

function getDateRange(period, dateString) {
  if (!["day", "week", "month"].includes(period)) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const selected = new Date(Date.UTC(year, month - 1, day));

  if (
    selected.getUTCFullYear() !== year ||
    selected.getUTCMonth() !== month - 1 ||
    selected.getUTCDate() !== day
  ) {
    return null;
  }

  let start;
  let end;

  if (period === "day") {
    start = bangkokDateToUTC(year, month, day);
    end = bangkokDateToUTC(year, month, day + 1);
  } else if (period === "week") {
    const weekday = selected.getUTCDay();
    const daysSinceMonday = (weekday + 6) % 7;

    const monday = new Date(selected);
    monday.setUTCDate(selected.getUTCDate() - daysSinceMonday);

    start = bangkokDateToUTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth() + 1,
      monday.getUTCDate()
    );

    const nextMonday = new Date(monday);
    nextMonday.setUTCDate(monday.getUTCDate() + 7);

    end = bangkokDateToUTC(
      nextMonday.getUTCFullYear(),
      nextMonday.getUTCMonth() + 1,
      nextMonday.getUTCDate()
    );
  } else {
    start = bangkokDateToUTC(year, month, 1);
    end = bangkokDateToUTC(year, month + 1, 1);
  }

  return { start, end };
}

// GET /api/dashboard/summary?period=week&date=2026-10-09
export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month";
    const date = searchParams.get("date") || "2026-10-09";

    const range = getDateRange(period, date);

    if (!range) {
      return errorResponse(
        "Use period=day, week, or month and a valid date=YYYY-MM-DD",
        400
      );
    }

    const result = await Transaction.aggregate([
      {
        $match: {
          date: {
            $gte: range.start,
            $lt: range.end,
          },
        },
      },
      {
        $group: {
          _id: "$type",
          totalAmountSatang: { $sum: "$amountSatang" },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    const summary = {
      period,
      date,
      startDate: range.start.toISOString(),
      endDateExclusive: range.end.toISOString(),
      totalIncomeSatang: 0,
      totalExpenseSatang: 0,
      netBalanceSatang: 0,
      transactionCount: 0,
    };

    for (const item of result) {
      if (item._id === "income") {
        summary.totalIncomeSatang = item.totalAmountSatang;
      } else if (item._id === "expense") {
        summary.totalExpenseSatang = item.totalAmountSatang;
      }

      summary.transactionCount += item.transactionCount;
    }

    summary.netBalanceSatang =
      summary.totalIncomeSatang - summary.totalExpenseSatang;

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error.message);
    return errorResponse("Failed to generate dashboard summary");
  }
}