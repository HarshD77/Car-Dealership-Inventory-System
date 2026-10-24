import type { Vehicle } from '../types';
import { CarOutline } from './Brand';

export function VehicleCard({ vehicle, admin }: { vehicle: Vehicle; admin: boolean }) {
  return <article className="vehicle-card" aria-label={`${vehicle.make} ${vehicle.model}`}>
    <div className="vehicle-art">
      <span className="category-pill">{vehicle.category}</span>
      <CarOutline className="card-car" />
    </div>
    <div className="p-5 sm:p-6">
      <p className="vehicle-make">{vehicle.make}</p>
      <h3>{vehicle.model}</h3>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-5 mb-5">
        <p className="price">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(vehicle.price / 100)}</p>
        <span className={`stock ${vehicle.quantity === 0 ? 'stock-empty' : ''}`}><i />{vehicle.quantity} in stock</span>
      </div>
      <button className="button button-primary w-full" disabled={vehicle.quantity === 0}>{vehicle.quantity === 0 ? 'Out of stock' : 'Purchase'}</button>
      {admin && <div className="admin-actions"><button>Edit</button><button>Restock</button><button className="delete-link">Delete</button></div>}
      <p className="vehicle-id" title={vehicle.id}>ID · {vehicle.id}</p>
    </div>
  </article>;
}
