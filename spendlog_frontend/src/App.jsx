
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";

import Home from "./pages/Home";
import Expenses from "./pages/Expenses";

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCategoryId, setBusyCategoryId] = useState(null);
  const [busyTransactionId, setBusyTransactionId] = useState(null);

  async function refreshData() {
    const [
      transactionResponse,
      categoryResponse,
      walletResponse,
    ] = await Promise.all([
      fetch("/api/transactions?limit=100"),
      fetch("/api/categories"),
      fetch("/api/wallets"),
    ]);

    if (
      !transactionResponse.ok ||
      !categoryResponse.ok ||
      !walletResponse.ok
    ) {
      throw new Error("Could not refresh data from the backend.");
    }

    const [
      transactionResult,
      categoryResult,
      walletResult,
    ] = await Promise.all([
      transactionResponse.json(),
      categoryResponse.json(),
      walletResponse.json(),
    ]);

    if (
      !transactionResult.success ||
      !categoryResult.success ||
      !walletResult.success
    ) {
      throw new Error("The backend returned an error.");
    }

    const formattedTransactions = transactionResult.data.map(
      (item) => ({
        ...item,
        date: String(item.date).slice(0, 10),
        categoryId:
          typeof item.categoryId === "object"
            ? item.categoryId?._id
            : item.categoryId,
        categoryName:
          typeof item.categoryId === "object"
            ? item.categoryId?.name
            : "",
        walletId:
          typeof item.walletId === "object"
            ? item.walletId?._id
            : item.walletId,
      })
    );

    const expenseTotals = {};

    formattedTransactions.forEach((item) => {
      if (item.type !== "expense" || !item.categoryId) return;

      expenseTotals[item.categoryId] =
        (expenseTotals[item.categoryId] || 0) +
        item.amountSatang;
    });

    setTransactions(formattedTransactions);

    setCategories(
      categoryResult.data
        .filter((category) => category.type === "expense")
        .map((category) => ({
          ...category,
          totalExpenseSatang: expenseTotals[category._id] || 0,
        }))
    );

    setWallets(walletResult.data);
  }

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        setError("");
        await refreshData();
      } catch (err) {
        setError(
          err.message || "Could not connect to the backend."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  async function handleAddCategory() {
    const name = window.prompt("Enter the expense category name:");

    if (name === null || !name.trim()) return;

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          type: "expense",
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not create expense category."
        );
      }

      await refreshData();
      window.alert("Expense category added successfully!");
    } catch (err) {
      window.alert(
        err.message || "Could not create expense category."
      );
    }
  }

  async function handleAddWallet() {
    const name = window.prompt("Enter the wallet name:");

    if (name === null || !name.trim()) return;

    const type = window.prompt(
      "Enter wallet type: cash or bank",
      "cash"
    );

    if (type === null) return;

    const walletType = type.trim().toLowerCase();

    if (!["cash", "bank"].includes(walletType)) {
      window.alert("Wallet type must be cash or bank.");
      return;
    }

    try {
      const response = await fetch("/api/wallets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          type: walletType,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not create wallet."
        );
      }

      await refreshData();
      window.alert("Wallet added successfully!");
    } catch (err) {
      window.alert(
        err.message || "Could not create wallet."
      );
    }
  }

  async function handleDeleteCategory(category) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${category.name}"?`
    );

    if (!confirmed) return;

    setBusyCategoryId(category._id);

    try {
      const response = await fetch(
        `/api/categories/${category._id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not delete category."
        );
      }

      await refreshData();
      window.alert("Category deleted successfully!");
    } catch (err) {
      window.alert(err.message || "Could not delete category.");
    } finally {
      setBusyCategoryId(null);
    }
  }

  // Create or update an expense, then optionally upload a receipt.
  async function handleSaveExpense({
    transaction,
    receipt,
    mode = "add",
    transactionId,
  }) {
    setError("");

    const isEdit = mode === "edit";

    if (isEdit && !transactionId) {
      throw new Error("Could not identify the expense to update.");
    }

    const response = await fetch(
      isEdit
        ? `/api/transactions/${transactionId}`
        : "/api/transactions",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...transaction,
          type: "expense",
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
          (isEdit
            ? "Could not update the expense."
            : "Could not save the expense.")
      );
    }

    const savedTransaction = result.data;

    if (receipt) {
      const formData = new FormData();
      formData.append("file", receipt);

      const receiptResponse = await fetch(
        `/api/transactions/${savedTransaction._id}/receipt`,
        {
          method: "PUT",
          body: formData,
        }
      );

      const receiptResult = await receiptResponse.json();

      if (!receiptResponse.ok || !receiptResult.success) {
        // The transaction itself was already saved.
        try {
          await refreshData();
        } catch {
          // Keep the original receipt error for the user.
        }

        throw new Error(
          isEdit
            ? "Expense updated, but the new receipt could not be uploaded. Please check the record before trying again."
            : "Expense saved, but the receipt could not be uploaded. Please check the record before trying again."
        );
      }
    }

    try {
      await refreshData();
    } catch {
      window.alert(
        "The expense was saved, but the latest data could not be loaded. Please reload the page."
      );
    }

    window.alert(
      isEdit
        ? "Expense updated successfully!"
        : "Expense saved successfully!"
    );
  }

  async function handleDeleteTransaction(transaction) {
    const confirmed = window.confirm(
      `Delete this expense?\n\n` +
        `${transaction.categoryName || "Uncategorized"} — ` +
        `${(transaction.amountSatang / 100).toFixed(2)} THB\n` +
        `${transaction.note || "No description"}`
    );

    if (!confirmed) return;

    setBusyTransactionId(transaction._id);

    try {
      const response = await fetch(
        `/api/transactions/${transaction._id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Could not delete the expense."
        );
      }

      await refreshData();
      window.alert("Expense deleted successfully!");
    } catch (err) {
      window.alert(err.message || "Could not delete the expense.");
    } finally {
      setBusyTransactionId(null);
    }
  }

  return (
    <BrowserRouter>
      <nav>
        <strong>SpendLog</strong>
        <NavLink to="/home">Home</NavLink>
        <NavLink to="/expenses">Expenses</NavLink>
      </nav>

      <Routes>
        <Route
          path="/"
          element={<Navigate to="/home" replace />}
        />

        <Route
          path="/home"
          element={
            <Home
              transactions={transactions}
              isLoading={isLoading}
              error={error}
            />
          }
        />

        <Route
          path="/expenses"
          element={
            <Expenses
              categories={categories}
              wallets={wallets}
              transactions={transactions}
              isLoading={isLoading}
              error={error}
              busyCategoryId={busyCategoryId}
              busyTransactionId={busyTransactionId}
              onAddCategory={handleAddCategory}
              onAddWallet={handleAddWallet}
              onDeleteCategory={handleDeleteCategory}
              onSaveExpense={handleSaveExpense}
              onDeleteTransaction={handleDeleteTransaction}
            />
          }
        />

        <Route
          path="*"
          element={<Navigate to="/home" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}