import type { Vehicle } from '../types';
import { CarOutline } from './Brand';
import { formatPrice } from '../money';

export function VehicleCard({
  vehicle,
  admin,
  disabled,
  purchasing,
  onPurchase,
  onAdmin,
}: {
  vehicle: Vehicle;
  admin: boolean;
  disabled: boolean;
  purchasing: boolean;
  onPurchase: () => void;
  onAdmin: (kind: 'edit' | 'restock' | 'delete') => void;
}) {
  return (
    <article className="vehicle-card" aria-label={`${vehicle.make} ${vehicle.model}`}>
      <div className="vehicle-art">
        <span className="category-pill">{vehicle.category}</span>
        <CarOutline className="card-car" />
      </div>
      <div className="p-5 sm:p-6">
        <p className="vehicle-make">{vehicle.make}</p>
        <h3>{vehicle.model}</h3>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 mb-5">
          <p className="price">{formatPrice(vehicle.price)}</p>
          <span className={`stock ${vehicle.quantity === 0 ? 'stock-empty' : ''}`}>
            <i />
            {vehicle.quantity} in stock
          </span>
        </div>
        <button
          className="button button-primary w-full"
          onClick={onPurchase}
          disabled={disabled || vehicle.quantity === 0}
        >
          {purchasing ? 'Purchasing…' : vehicle.quantity === 0 ? 'Out of stock' : 'Purchase'}
        </button>
        {admin && (
          <div className="admin-actions">
            <button disabled={disabled} onClick={() => onAdmin('edit')}>
              Edit
            </button>
            <button disabled={disabled} onClick={() => onAdmin('restock')}>
              Restock
            </button>
            <button disabled={disabled} className="delete-link" onClick={() => onAdmin('delete')}>
              Delete
            </button>
          </div>
        )}
        <p className="vehicle-id" title={vehicle.id}>
          ID · {vehicle.id}
        </p>
      </div>
    </article>
  );
}
