import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Vehicle, VehicleInput } from '../types';
import { centsToDollars, dollarsToCents } from '../money';

export type InventoryAction =
  | { kind: 'add' }
  | { kind: 'edit' | 'restock' | 'delete'; vehicle: Vehicle };
export type InventoryPayload = VehicleInput | { quantity: number } | undefined;

function quantityValue(value: string, positive: boolean) {
  const quantity = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(quantity) || quantity < (positive ? 1 : 0)) {
    throw new Error(
      positive
        ? 'Quantity must be a positive whole number.'
        : 'Quantity must be a nonnegative whole number.',
    );
  }
  return quantity;
}

export function InventoryDialog({
  action,
  onSave,
  onClose,
}: {
  action: InventoryAction;
  onSave: (input: InventoryPayload) => Promise<void>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const vehicle = action.kind === 'add' ? undefined : action.vehicle;
  const editing = action.kind === 'add' || action.kind === 'edit';
  const title = {
    add: 'Add vehicle',
    edit: 'Edit vehicle',
    restock: 'Restock vehicle',
    delete: 'Delete vehicle',
  }[action.kind];
  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    try {
      let input: InventoryPayload;
      if (editing) {
        const make = String(form.get('make')).trim();
        const model = String(form.get('model')).trim();
        const category = String(form.get('category')).trim();
        if (!make || !model || !category)
          throw new Error('Make, model, and category are required.');
        input = {
          make,
          model,
          category,
          price: dollarsToCents(String(form.get('price')).trim()),
          quantity: quantityValue(String(form.get('quantity')), false),
        };
      } else if (action.kind === 'restock') {
        input = { quantity: quantityValue(String(form.get('quantity')), true) };
      }
      busy.current = true;
      setPending(true);
      setError('');
      await onSave(input);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <dialog
      ref={dialogRef}
      className="inventory-dialog"
      aria-labelledby="inventory-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow text-teal-800">INVENTORY MANAGEMENT</p>
          <h2 id="inventory-dialog-title">{title}</h2>
        </div>
        <button
          type="button"
          className="close-dialog"
          aria-label="Close dialog"
          disabled={pending}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p className="muted text-sm mb-6">
        {action.kind === 'add'
          ? 'Add the details for your next showroom arrival.'
          : `${vehicle!.make} ${vehicle!.model}`}
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={pending} className="space-y-5">
          {editing && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="field">
                  Make
                  <input
                    name="make"
                    required
                    maxLength={100}
                    defaultValue={vehicle?.make ?? ''}
                    autoFocus
                  />
                </label>
                <label className="field">
                  Model
                  <input
                    name="model"
                    required
                    maxLength={100}
                    defaultValue={vehicle?.model ?? ''}
                  />
                </label>
              </div>
              <label className="field">
                Category
                <input
                  name="category"
                  required
                  maxLength={100}
                  placeholder="e.g. Sedan, SUV, Hatchback"
                  defaultValue={vehicle?.category ?? ''}
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="field">
                  Price ($)
                  <input
                    name="price"
                    required
                    inputMode="decimal"
                    defaultValue={vehicle ? centsToDollars(vehicle.price) : ''}
                    placeholder="0.00"
                  />
                </label>
                <label className="field">
                  Quantity in stock
                  <input
                    name="quantity"
                    type="number"
                    required
                    min={0}
                    step={1}
                    max={Number.MAX_SAFE_INTEGER}
                    defaultValue={vehicle?.quantity ?? 0}
                  />
                </label>
              </div>
              <p className="text-xs muted">Prices are in USD. Enter a whole number for stock.</p>
            </>
          )}
          {action.kind === 'restock' && (
            <>
              <p className="notice">Current stock: {vehicle!.quantity}</p>
              <label className="field">
                Quantity to add
                <input
                  name="quantity"
                  type="number"
                  required
                  min={1}
                  step={1}
                  max={Number.MAX_SAFE_INTEGER}
                  defaultValue={1}
                  autoFocus
                />
              </label>
            </>
          )}
          {action.kind === 'delete' && (
            <p className="notice">Remove this vehicle from the inventory? This cannot be undone.</p>
          )}
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="button button-secondary"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={`button ${action.kind === 'delete' ? 'button-danger' : 'button-primary'}`}
              disabled={pending}
            >
              {pending
                ? editing
                  ? 'Saving…'
                  : action.kind === 'restock'
                    ? 'Restocking…'
                    : 'Deleting…'
                : editing
                  ? 'Save vehicle'
                  : title}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
