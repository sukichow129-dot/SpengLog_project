
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Transaction from "@/models/Transaction";

function errorResponse(message, status = 500) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

function parseDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

// A Bangkok calendar day begins at 17:00 UTC on the previous day.
function bangkokDateToUTC(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, -7, 0, 0));
}

function getTrendRange(period, dateString) {
  const selected = parseDate(dateString);
  if (!selected) return null;

  let firstDay;
  let numberOfDays;

  if (period === "day") {
    numberOfDays = 7;
    firstDay = new Date(selected);
    firstDay.setUTCDate(selected.getUTCDate() - 6);
  } else if (period === "week") {
    const daysSinceMonday = (selected.getUTCDay() + 6) % 7;
    firstDay = new Date(selected);
    firstDay.setUTCDate(selected.getUTCDate() - daysSinceMonday);
    numberOfDays = 7;
  } else if (period === "month") {
    firstDay = new Date(
      Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1)
    );
    numberOfDays = new Date(
      Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + 1, 0)
    ).getUTCDate();
  } else {
    return null;
  }

  const lastDay = new Date(firstDay);
  lastDay.setUTCDate(firstDay.getUTCDate() + numberOfDays);

  return {
    firstDay,
    numberOfDays,
    start: bangkokDateToUTC(
      firstDay.getUTCFullYear(),
      firstDay.getUTCMonth() + 1,
      firstDay.getUTCDate()
    ),
    end: bangkokDateToUTC(
      lastDay.getUTCFullYear(),
      lastDay.getUTCMonth() + 1,
      lastDay.getUTCDate()
    ),
  };
}

function formatDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

// GET /api/dashboard/trend?period=day&date=2026-10-09
export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "day";
    const date = searchParams.get("date") || "2026-10-09";

    const range = getTrendRange(period, date);

    if (!range) {
      return errorResponse(
        "Use period=day, week, or month and a valid date=YYYY-MM-DD",
        400
      );
    }

    const totals = await Transaction.aggregate([
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
          _id: {
            date: {
              $dateToString: {
                date: "$date",
                format: "%Y-%m-%d",
                timezone: "Asia/Bangkok",
              },
            },
            type: "$type",
          },
          totalAmountSatang: { $sum: "$amountSatang" },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    const dailyData = new Map();

    for (let i = 0; i < range.numberOfDays; i++) {
      const day = new Date(range.firstDay);
      day.setUTCDate(range.firstDay.getUTCDate() + i);

      const dateKey = formatDate(day);

      dailyData.set(dateKey, {
        date: dateKey,
        incomeSatang: 0,
        expenseSatang: 0,
        netSatang: 0,
        transactionCount: 0,
      });
    }

    for (const item of totals) {
      const dateKey = item._id.date;
      const entry = dailyData.get(dateKey);

      if (!entry) continue;

      if (item._id.type === "income") {
        entry.incomeSatang = item.totalAmountSatang;
      } else if (item._id.type === "expense") {
        entry.expenseSatang = item.totalAmountSatang;
      }

      entry.transactionCount += item.transactionCount;
    }

    const trend = Array.from(dailyData.values()).map((entry) => ({
      ...entry,
      netSatang: entry.incomeSatang - entry.expenseSatang,
    }));

    return NextResponse.json({
      success: true,
      data: {
        period,
        date,
        startDate: range.start.toISOString(),
        endDateExclusive: range.end.toISOString(),
        trend,
      },
    });
  } catch (error) {
    console.error("Dashboard trend error:", error.message);
    return errorResponse("Failed to generate trend data");
  }
}