import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { Session, Vehicle } from '../types';
import { Brand } from './Brand';
import { VehicleCard } from './VehicleCard';

export function Dashboard({ session, onSignOut }: { session: Session; onSignOut: (expired?: boolean) => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const admin = session.user.role === 'admin';
  useEffect(() => {
    const controller = new AbortController();
    api<Vehicle[]>('/vehicles', { token: session.token, signal: controller.signal })
      .then(setVehicles).catch(failure => {
        if (controller.signal.aborted) return;
        if (failure instanceof ApiError && failure.status === 401) onSignOut(true);
        else setError(failure.message);
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session.token, onSignOut]);
  return <div className="app-shell">
    <header className="app-header"><div className="header-inner">
      <Brand /><nav aria-label="Account" className="account-nav">
        <span className="role-badge">{admin ? 'Admin' : 'Member'}</span>
        <span className="account-email">{session.user.email}</span>
        <button className="button button-quiet" onClick={() => onSignOut()}>Sign out</button>
      </nav>
    </div></header>
    <main className="dashboard">
      <div className="dashboard-intro"><div><p className="eyebrow text-teal-800">THE SHOWROOM</p>
        <h1>{admin ? 'Your inventory, in view.' : 'Find your next drive.'}</h1>
        <p className="muted mt-3">{admin ? 'Keep every vehicle and every stock level up to date.' : 'Explore our vehicles and make your next move.'}</p>
      </div>{admin && <button className="button button-primary">Add vehicle</button>}</div>
      {error && <p role="alert" className="error-box mb-6">{error}</p>}
      {loading ? <p role="status" className="empty-state">Loading inventory…</p> :
        vehicles.length ? <><p className="results-label">{vehicles.length} vehicles in the showroom</p><div className="vehicle-grid">{vehicles.map(vehicle => <VehicleCard key={vehicle.id} vehicle={vehicle} admin={admin} />)}</div></> :
        !error && <div className="empty-state"><h2>No vehicles yet</h2><p className="muted">{admin ? 'Add your first vehicle to get started.' : 'New vehicles will appear here when they are added.'}</p></div>}
    </main>
    <footer className="app-footer"><span>MOTORLINE</span><span>Car dealership inventory</span></footer>
  </div>;
}
