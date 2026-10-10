import { useEffect, useRef, useState } from "react";
import "./AddExpenseModal.css";

export default function AddExpenseModal({
  category,
  categories = [],
  wallets = [],
  onClose,
  onSave,
  mode = "add",
  initialTransaction = null,
}) {
  const isEdit = mode === "edit";

  const dialogRef = useRef(null);
  const savingRef = useRef(false);

  const [amount, setAmount] = useState(
    initialTransaction
      ? (initialTransaction.amountSatang / 100).toFixed(2)
      : ""
  );

  const [date, setDate] = useState(
    initialTransaction?.date
      ? String(initialTransaction.date).slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );

  const [categoryId, setCategoryId] = useState(
    typeof initialTransaction?.categoryId === "object"
      ? initialTransaction.categoryId?._id || category?._id || ""
      : initialTransaction?.categoryId || category?._id || ""
  );

  const [walletId, setWalletId] = useState(
    typeof initialTransaction?.walletId === "object"
      ? initialTransaction.walletId?._id || ""
      : initialTransaction?.walletId || ""
  );

  const [note, setNote] = useState(
    initialTransaction?.note || ""
  );

  const [receipt, setReceipt] = useState(null);
  const [preview, setPreview] = useState("");

  const [existingReceipt, setExistingReceipt] = useState(
    Boolean(initialTransaction?.receiptFileId)
  );

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;

    if (!dialog.open) {
      dialog.showModal();
    }

    document.body.style.overflow = "hidden";

    return () => {
      if (dialog.open) {
        dialog.close();
      }

      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!receipt) {
      setPreview("");
      return;
    }

    const url = URL.createObjectURL(receipt);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [receipt]);

  useEffect(() => {
    setExistingReceipt(
      Boolean(isEdit && initialTransaction?.receiptFileId)
    );
  }, [
    isEdit,
    initialTransaction?._id,
    initialTransaction?.receiptFileId,
  ]);

  function selectReceipt(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Choose a JPG or PNG image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("The receipt must be 5 MB or smaller.");
      return;
    }

    setError("");
    setReceipt(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (savingRef.current) return;

    const value = amount.trim();

    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
      setError("Enter an amount with up to two decimal places.");
      return;
    }

    const [whole, decimal = ""] = value.split(".");

    const amountSatang =
      Number(whole) * 100 +
      Number(decimal.padEnd(2, "0"));

    if (
      !Number.isSafeInteger(amountSatang) ||
      amountSatang <= 0
    ) {
      setError("Enter a valid amount greater than zero.");
      return;
    }

    if (!date || !categoryId || !walletId) {
      setError("Select a date, category and wallet.");
      return;
    }

    if (!onSave) {
      setError("Saving is not connected yet.");
      return;
    }

    if (isEdit && !initialTransaction?._id) {
      setError("Could not identify the expense to update.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError("");

    try {
      await onSave({
        transaction: {
          type: "expense",
          amountSatang,
          date,
          categoryId,
          walletId,
          note: note.trim(),
        },
        receipt,
        mode,
        transactionId: initialTransaction?._id,
      });

      onClose();
    } catch (err) {
      setError(err.message || "Could not save the expense.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const selectedCategoryName =
    categories.find((item) => item._id === categoryId)?.name ||
    category?.name ||
    "your category";

  return (
    <dialog
      ref={dialogRef}
      className="expense-modal"
      aria-labelledby="expense-modal-title"
      onCancel={(event) => {
        event.preventDefault();

        if (!savingRef.current) {
          onClose();
        }
      }}
    >
      <form onSubmit={handleSubmit}>
        <header className="expense-modal-header">
          <div>
            <h2 id="expense-modal-title">
              {isEdit ? "Edit Expense" : "Add Expense"}
            </h2>

            <p>
              {isEdit
                ? "Update your expense details."
                : `Record a payment under ${selectedCategoryName}.`}
            </p>
          </div>

          <button
            type="button"
            className="expense-modal-close"
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <fieldset
          className="expense-modal-fields"
          disabled={saving}
        >
          <label>
            Category

            <select
              value={categoryId}
              onChange={(event) =>
                setCategoryId(event.target.value)
              }
              required
            >
              <option value="">Select category</option>

              {categories.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}

              {categoryId &&
                !categories.some(
                  (item) => item._id === categoryId
                ) && (
                  <option value={categoryId}>
                    {category?.name ||
                      initialTransaction?.categoryName ||
                      "Current category"}
                  </option>
                )}
            </select>
          </label>

          <label>
            Amount (THB)

            <input
              type="text"
              inputMode="decimal"
              placeholder="Enter amount"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value)
              }
              required
              autoFocus
            />
          </label>

          <label>
            Date

            <input
              type="date"
              value={date}
              onChange={(event) =>
                setDate(event.target.value)
              }
              required
            />
          </label>

          <label>
            Wallet

            <select
              value={walletId}
              onChange={(event) =>
                setWalletId(event.target.value)
              }
              required
            >
              <option value="">Select wallet</option>

              {wallets.map((wallet) => (
                <option key={wallet._id} value={wallet._id}>
                  {wallet.name}
                </option>
              ))}
            </select>
          </label>

          {wallets.length === 0 && (
            <p className="expense-modal-help">
              Create a wallet before adding an expense.
            </p>
          )}

          <label>
            Note (optional)

            <textarea
              rows={3}
              placeholder="Add a description"
              value={note}
              onChange={(event) =>
                setNote(event.target.value)
              }
            />
          </label>

          {existingReceipt && !receipt && (
            <div className="expense-receipt-preview">
              <img
                src={`/api/transactions/${initialTransaction._id}/receipt`}
                alt="Existing expense receipt"
              />

              <span>Existing receipt</span>
            </div>
          )}

          <label>
            {existingReceipt
              ? "Replace Receipt (optional)"
              : "Receipt (optional)"}

            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={selectReceipt}
            />
          </label>

          <p className="expense-modal-help">
            JPG or PNG, up to 5 MB.{" "}
            {existingReceipt &&
              "The existing receipt will be kept unless you upload a new one."}
          </p>

          {receipt && (
            <div className="expense-receipt-preview">
              {preview && (
                <img
                  src={preview}
                  alt="Selected receipt preview"
                />
              )}

              <span>{receipt.name}</span>

              <button
                type="button"
                disabled={saving}
                onClick={() => setReceipt(null)}
              >
                Remove selected receipt
              </button>
            </div>
          )}
        </fieldset>

        {error && (
          <p className="expense-modal-error" role="alert">
            {error}
          </p>
        )}

        <footer className="expense-modal-footer">
          <button
            type="button"
            className="expense-cancel"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="expense-save"
            disabled={saving || wallets.length === 0 || !onSave}
          >
            {saving
              ? "Saving…"
              : isEdit
                ? "Update Expense"
                : "Save Expense"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}