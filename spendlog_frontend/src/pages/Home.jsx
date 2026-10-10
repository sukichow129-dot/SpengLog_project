import { useState } from "react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

import "./Home.css";

const PERIODS = ["Daily", "Weekly", "Monthly", "Yearly"];

const EMPTY_TRANSACTIONS = [];

function getTodayInBangkok() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const get = (type) => parts.find((part) => part.type === type).value;

    return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    ...options,
  }).format(date);
}

function formatMoney(satang) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
  }).format(satang / 100);
}

function getRange(period, selectedDate) {
  const start = parseDate(selectedDate);
  let end;

  switch (period) {
    case "Daily":
      end = addDays(start, 1);
      break;

    case "Weekly": {
      const daysSinceMonday = (start.getUTCDay() + 6) % 7;
      start.setUTCDate(start.getUTCDate() - daysSinceMonday);
      end = addDays(start, 7);
      break;
    }

    case "Monthly":
      start.setUTCDate(1);
      end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      break;

    case "Yearly":
      start.setUTCMonth(0, 1);
      end = new Date(start);
      end.setUTCFullYear(end.getUTCFullYear() + 1);
      break;

    default:
      throw new Error("Unsupported reporting period");
  }

  return { start, end };
}

function getRangeLabel(start, end) {
  const options = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };

  const first = formatDate(start, options);
  const last = formatDate(addDays(end, -1), options);

  return first === last ? first : `${first} – ${last}`;
}

function filterByRange(transactions, start, end) {
  const first = dateKey(start);
  const last = dateKey(end);

  return transactions.filter(
    (transaction) =>
      transaction.date >= first && transaction.date < last
  );
}

function sumAmounts(transactions) {
  return transactions.reduce(
    (total, transaction) => total + transaction.amountSatang,
    0
  );
}

function buildCategoryData(expenses) {
  const totals = new Map();

  expenses.forEach((expense) => {
    // Group by ID so categories with the same name remain separate.
    const key = expense.categoryId;

    const existing = totals.get(key) || {
      name: expense.categoryName || "Uncategorized",
      amountSatang: 0,
    };

    existing.amountSatang += expense.amountSatang;
    totals.set(key, existing);
  });

  return [...totals.values()]
    .sort((a, b) => b.amountSatang - a.amountSatang)
    .map((category) => ({
      name: category.name,
      amount: category.amountSatang / 100,
    }));
}

function buildTrendData(expenses, period, start, end, today) {
  const points = [];

  for (
    let cursor = new Date(start);
    cursor < end;
  ) {
    const bucketStart = new Date(cursor);
    let bucketEnd;
    let name;

    if (period === "Yearly") {
      bucketEnd = new Date(bucketStart);
      bucketEnd.setUTCMonth(bucketEnd.getUTCMonth() + 1);
      name = formatDate(bucketStart, { month: "short" });
    } else {
      bucketEnd = addDays(bucketStart, 1);

      if (period === "Weekly") {
        name = formatDate(bucketStart, { weekday: "short" });
      } else if (period === "Monthly") {
        name = String(bucketStart.getUTCDate());
      } else {
        name = formatDate(bucketStart, {
          day: "numeric",
          month: "short",
        });
      }
    }

    const records = filterByRange(
      expenses,
      bucketStart,
      bucketEnd
    );

    points.push({
      name,
      // Future buckets have no bar, rather than implying zero spending.
      amount:
        dateKey(bucketStart) > today
          ? null
          : sumAmounts(records) / 100,
    });

    cursor = bucketEnd;
  }

  return points;
}

function SpendingChart({ data, categoryChart = false }) {
  return (
    <div className="spending-chart">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
      >
        <BarChart
          data={data}
          margin={{ top: 15, right: 12, bottom: 5, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid
            vertical={false}
            stroke="#adcde6"
          />

          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#24465c", fontSize: 12 }}
            minTickGap={8}
            angle={categoryChart ? -25 : 0}
            textAnchor={categoryChart ? "end" : "middle"}
            height={categoryChart ? 80 : 45}
          />

          <YAxis
            domain={[0, "auto"]}
            width={70}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#24465c", fontSize: 12 }}
            tickFormatter={(value) =>
              new Intl.NumberFormat("en-US", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(value)
            }
          />

          <Tooltip
            formatter={(value) => [
              new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "THB",
              }).format(Number(value)),
              "Expenses",
            ]}
            cursor={{
              fill: "rgba(255, 255, 255, 0.3)",
            }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #adcde6",
            }}
          />

          <Bar
            dataKey="amount"
            fill="#477df5"
            radius={[9, 9, 0, 0]}
            maxBarSize={70}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}

export default function Home({
  transactions = EMPTY_TRANSACTIONS,
  isLoading = false,
  error = "",
}) {
  const [period, setPeriod] = useState("Weekly");
  const [selectedDate, setSelectedDate] = useState(
    getTodayInBangkok
  );

  const today = getTodayInBangkok();
  const { start, end } = getRange(period, selectedDate);

  // Exclude future-dated transactions from actual spending reports.
  const recordedTransactions = transactions.filter(
    (transaction) => transaction.date <= today
  );

  const selectedTransactions = filterByRange(
    recordedTransactions,
    start,
    end
  );

  const income = selectedTransactions.filter(
    (transaction) => transaction.type === "income"
  );

  const expenses = selectedTransactions.filter(
    (transaction) => transaction.type === "expense"
  );

  const incomeTotal = sumAmounts(income);
  const expenseTotal = sumAmounts(expenses);
  const categoryData = buildCategoryData(expenses);

  // Daily trend shows seven days ending on the selected date.
  const trendStart =
    period === "Daily"
      ? addDays(parseDate(selectedDate), -6)
      : start;

  const allExpenses = recordedTransactions.filter(
    (transaction) => transaction.type === "expense"
  );

  const trendExpenses = filterByRange(
    allExpenses,
    trendStart,
    end
  );

  const trendData = buildTrendData(
    trendExpenses,
    period,
    trendStart,
    end,
    today
  );

  const containsToday =
    dateKey(start) <= today && today < dateKey(end);

  const periodLabel = containsToday
    ? `${getRangeLabel(start, end)} · ${
        period === "Yearly" ? "Year to date" : "So far"
      }`
    : getRangeLabel(start, end);

  function renderChart(data, hasRecords, categoryChart = false) {
    if (isLoading) {
      return <EmptyState>Loading expenses…</EmptyState>;
    }

    if (error) {
      return <EmptyState>Expense data is unavailable.</EmptyState>;
    }

    if (!hasRecords) {
      return (
        <EmptyState>
          No expenses recorded for this period.
        </EmptyState>
      );
    }

    return (
      <SpendingChart
        data={data}
        categoryChart={categoryChart}
      />
    );
  }

  return (
    <main className="home-page" aria-busy={isLoading}>
      <header className="dashboard-toolbar">
        <div>
          <h1>Overview</h1>
          <p className="dashboard-description">
            Track your income and spending.
          </p>
        </div>

        <label className="date-control">
          Select a date
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(event) => {
              const value = event.target.value;

              if (value && event.target.validity.valid) {
                setSelectedDate(value);
              }
            }}
          />
        </label>
      </header>

      <div
        className="period-buttons"
        role="group"
        aria-label="Dashboard reporting period"
      >
        {PERIODS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={period === item}
            onClick={() => setPeriod(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      <section className="dashboard-card">
        <h2>Income / Expenses</h2>
        <p className="period-caption">{periodLabel}</p>

        <div className="summary-grid">
          <div className="summary-circle">
            <span>Income</span>
            <strong>
              {isLoading || error
                ? "—"
                : formatMoney(incomeTotal)}
            </strong>
          </div>

          <div className="summary-circle">
            <span>Expenses</span>
            <strong>
              {isLoading || error
                ? "—"
                : formatMoney(expenseTotal)}
            </strong>
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <h2>Expenses by Category</h2>
        <p className="period-caption">
          {periodLabel} · Amount in THB
        </p>

        {renderChart(
          categoryData,
          expenses.length > 0,
          true
        )}
      </section>

      <section className="dashboard-card">
        <h2>Money Usage</h2>
        <p className="period-caption">
          {period === "Daily"
            ? `Last 7 days · ${getRangeLabel(trendStart, end)}`
            : periodLabel}
          {" · "}
          {period === "Yearly"
            ? "Monthly totals"
            : "Daily totals"}
          {" · THB"}
        </p>

        {renderChart(trendData, trendExpenses.length > 0)}
      </section>
    </main>
  );
}
