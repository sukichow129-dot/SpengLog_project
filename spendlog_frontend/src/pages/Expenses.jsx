import "./Expenses.css";
import { useState } from "react";
import AddExpenseModal from "../components/AddExpenseModel.jsx";

const EMPTY_CATEGORIES = [];
const EMPTY_TRANSACTIONS = [];

function formatAmount(satang) {
  if (!Number.isSafeInteger(satang)) {
    return "— THB";
  }

  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(satang / 100)} THB`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function Expenses({
  categories = EMPTY_CATEGORIES,
  wallets = [],
  transactions = EMPTY_TRANSACTIONS,
  isLoading = false,
  error = "",
  busyCategoryId = null,
  busyTransactionId = null,
  onAddCategory,
  onAddWallet,
  onSaveExpense,
  onDeleteCategory,
  onDeleteTransaction,
  onOpenCategory,
}) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);

  const expenseTransactions = transactions
    .filter((transaction) => transaction.type === "expense")
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  function getWalletName(transaction) {
    const wallet = wallets.find(
      (item) => item._id === transaction.walletId
    );

    return transaction.walletName || wallet?.name || "Unknown wallet";
  }

  return (
    <main className="expenses-page" aria-busy={isLoading}>
      <header className="expenses-heading">
        <div>
          <h1>Categories</h1>
          <p className="expenses-description">
            Organize your expenses and payment receipts.
          </p>
        </div>

        <div className="category-actions">
          <button
            className="expense-action"
            type="button"
            onClick={onAddCategory}
            disabled={isLoading || !onAddCategory}
          >
            Add Category
          </button>

          <button
            className="expense-action"
            type="button"
            onClick={onAddWallet}
            disabled={isLoading || !onAddWallet}
          >
            Add Wallet
          </button>
        </div>
      </header>

      {/* Wallets */}
      <section className="wallet-section">
        <h2>My Wallets</h2>

        {isLoading ? (
          <p>Loading wallets...</p>
        ) : wallets.length === 0 ? (
          <p>No wallets yet. Click Add Wallet to create one.</p>
        ) : (
          <ul className="category-list">
            {wallets.map((wallet) => (
              <li className="category-row" key={wallet._id}>
                <div className="category-information">
                  <span className="category-name">{wallet.name}</span>
                  <span className="category-total">
                    {wallet.type === "cash" ? "Cash" : "Bank"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Categories */}
      <p className="category-period">
        Totals: all recorded expenses
      </p>

      {error && (
        <p className="expenses-error" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="expenses-empty" role="status">
          Loading categories…
        </p>
      ) : error ? (
        <p className="expenses-empty">
          Categories could not be loaded.
        </p>
      ) : categories.length === 0 ? (
        <div className="expenses-empty">
          <h2>No categories yet</h2>
          <p>Add a category to start organizing your expenses.</p>
        </div>
      ) : (
        <ul className="category-list">
          {categories.map((category) => {
            const busy = busyCategoryId === category._id;

            return (
              <li className="category-row" key={category._id}>
                <div className="category-information">
                  {onOpenCategory ? (
                    <button
                      className="category-name"
                      type="button"
                      onClick={() => onOpenCategory(category)}
                      disabled={busy}
                    >
                      {category.name}
                    </button>
                  ) : (
                    <span className="category-name">
                      {category.name}
                    </span>
                  )}

                  <span className="category-total">
                    {formatAmount(category.totalExpenseSatang)}
                  </span>
                </div>

                <div className="category-actions">
                  <button
                    className="expense-action"
                    type="button"
                    disabled={busy}
                    onClick={() => setSelectedCategory(category)}
                    aria-label={`Add expense to ${category.name}`}
                  >
                    Add Expense
                  </button>

                  <button
                    className="expense-action"
                    type="button"
                    disabled={busy || !onDeleteCategory}
                    onClick={() => onDeleteCategory(category)}
                    aria-label={`Delete category ${category.name}`}
                  >
                    <svg
                      className="delete-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18M9 6V3h6v3" />
                      <path d="m5 6 1 15h12l1-15M10 10v7M14 10v7" />
                    </svg>
                    Delete Category
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Expense Records */}
      <section className="expense-records-section">
        <h2>Expense Records</h2>
        <p className="category-period">
          View and manage each recorded expense.
        </p>

        {isLoading ? (
          <p className="expenses-empty" role="status">
            Loading expense records…
          </p>
        ) : expenseTransactions.length === 0 ? (
          <div className="expenses-empty">
            <h3>No expense records yet</h3>
            <p>Your recorded expenses will appear here.</p>
          </div>
        ) : (
          <ul className="category-list">
            {expenseTransactions.map((transaction) => {
              const busy =
                busyTransactionId === transaction._id;

              return (
                <li
                  className="category-row expense-record-row"
                  key={transaction._id}
                >
                  <div className="category-information expense-record-information">
                    <div className="expense-record-main">
                      <span className="category-name">
                        {transaction.categoryName || "Uncategorized"}
                      </span>

                      <span className="category-total">
                        {formatAmount(transaction.amountSatang)}
                      </span>
                    </div>

                    <div className="expense-record-details">
                      <span>
                        Date: {formatDate(transaction.date)}
                      </span>

                      <span>
                        Wallet: {getWalletName(transaction)}
                      </span>

                      {transaction.note && (
                        <span>Note: {transaction.note}</span>
                      )}
                    </div>
                  </div>

                  <div className="category-actions">
                    <button
                      className="expense-action"
                      type="button"
                      disabled={busy}
                      onClick={() => setEditingTransaction(transaction)}
                    >
                      Edit
                    </button>

                    <button
                      className="expense-action"
                      type="button"
                      disabled={busy || !onDeleteTransaction}
                      onClick={() => {
                        const confirmed = window.confirm(
                          `Delete this expense?\n\n` +
                            `${transaction.categoryName || "Uncategorized"} — ` +
                            `${formatAmount(transaction.amountSatang)}\n` +
                            `${transaction.note || "No description"}`
                        );

                        if (confirmed) {
                          onDeleteTransaction(transaction);
                        }
                      }}
                    >
                      Delete Expense
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Add Expense Modal */}
      {selectedCategory && (
        <AddExpenseModal
          category={selectedCategory}
          categories={categories}
          wallets={wallets}
          onClose={() => setSelectedCategory(null)}
          onSave={onSaveExpense}
        />
      )}

      {/* Edit Expense Modal */}
      {editingTransaction && (
        <AddExpenseModal
          key={editingTransaction._id}
          mode="edit"
          transactionId={editingTransaction._id}
          initialTransaction={editingTransaction}
          category={
            categories.find(
              (category) =>
                category._id === editingTransaction.categoryId
            ) || {
              _id: editingTransaction.categoryId,
              name: editingTransaction.categoryName || "Uncategorized",
            }
          }
          categories={categories}
          wallets={wallets}
          onClose={() => setEditingTransaction(null)}
          onSave={onSaveExpense}
        />
      )}

      {/* Keep the original preview button */}
      {/* <button
        type="button"
        onClick={() =>
          setSelectedCategory({
            _id: "",
            name: "Form preview",
          })
        }
      >
        Preview expense form
      </button> */}
    </main>
  );
}