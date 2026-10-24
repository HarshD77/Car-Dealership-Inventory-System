import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import type { Session, Vehicle } from '../types';
import { Brand } from './Brand';
import { VehicleCard } from './VehicleCard';
import { SearchForm } from './SearchForm';
import { InventoryDialog, type InventoryAction, type InventoryPayload } from './InventoryDialog';

export function Dashboard({ session, onSignOut }: { session: Session; onSignOut: (expired?: boolean) => void }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const mutationBusy = useRef(false);
  const requestId = useRef(0);
  const [action, setAction] = useState<InventoryAction | null>(null);
  const admin = session.user.role === 'admin';
  const load = useCallback(async (signal?: AbortSignal) => {
    const current = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const result = await api<Vehicle[]>(query ? `/vehicles/search?${query}` : '/vehicles', { token: session.token, signal });
      if (!signal?.aborted && current === requestId.current) setVehicles(result);
    } catch (failure) {
      if (!signal?.aborted && current === requestId.current) {
        if (failure instanceof ApiError && failure.status === 401) onSignOut(true);
        else setError((failure as Error).message);
      }
    } finally { if (!signal?.aborted && current === requestId.current) setLoading(false); }
  }, [query, session.token, onSignOut]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function purchase(vehicle: Vehicle) {
    if (mutationBusy.current) return;
    mutationBusy.current = true;
    setPending(vehicle.id);
    setMessage(null);
    try {
      await api<Vehicle>(`/vehicles/${vehicle.id}/purchase`, { token: session.token, method: 'POST' });
      setMessage({ text: `Purchased one ${vehicle.make} ${vehicle.model}.`, error: false });
      await load();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onSignOut(true);
      else {
        setMessage({ text: (failure as Error).message, error: true });
        if (failure instanceof ApiError && [404, 409].includes(failure.status)) await load();
      }
    } finally { mutationBusy.current = false; setPending(null); }
  }

  function search(next: string) {
    setMessage(null);
    if (next === query) void load();
    else setQuery(next);
  }

  async function saveInventory(input: InventoryPayload) {
    if (!action || mutationBusy.current) return;
    mutationBusy.current = true;
    setPending('admin');
    setMessage(null);
    const path = action.kind === 'add' ? '/vehicles' : `/vehicles/${action.vehicle.id}${action.kind === 'restock' ? '/restock' : ''}`;
    const method = action.kind === 'delete' ? 'DELETE' : action.kind === 'edit' ? 'PUT' : 'POST';
    try {
      await api(path, { token: session.token, method, body: input });
      setAction(null);
      setMessage({ text: { add: 'Vehicle added.', edit: 'Vehicle updated.', delete: 'Vehicle deleted.', restock: 'Vehicle restocked.' }[action.kind], error: false });
      await load();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onSignOut(true);
      throw failure;
    } finally { mutationBusy.current = false; setPending(null); }
  }
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
      </div>{admin && <button className="button button-primary" disabled={loading || pending !== null} onClick={() => setAction({ kind: 'add' })}>Add vehicle</button>}</div>
      {message && <p role={message.error ? 'alert' : 'status'} className={`${message.error ? 'error-box' : 'success-box'} mb-6`}>{message.text}</p>}
      <div className="inventory-layout">
        <SearchForm onSearch={search} disabled={loading || pending !== null} />
        <section aria-label="Vehicle inventory" className="min-w-0">
          {error && <div role="alert" className="error-box mb-6">{error}<button className="button button-secondary ml-3" onClick={() => void load()}>Retry</button></div>}
          {loading ? <p role="status" className="empty-state">Loading inventory…</p> :
            !error && (vehicles.length ? <><p className="results-label">{vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'} {query ? 'matching your filters' : 'in the showroom'}</p><div className="vehicle-grid">{vehicles.map(vehicle => <VehicleCard key={vehicle.id} vehicle={vehicle} admin={admin} disabled={pending !== null} purchasing={pending === vehicle.id} onPurchase={() => void purchase(vehicle)} onAdmin={kind => setAction({ kind, vehicle })} />)}</div></> :
              <div className="empty-state"><h2>{query ? 'No matching vehicles' : 'No vehicles yet'}</h2><p className="muted">{query ? 'Try a different search or clear your filters.' : admin ? 'Add your first vehicle to get started.' : 'New vehicles will appear here when they are added.'}</p></div>)}
        </section>
      </div>
    </main>
    <footer className="app-footer"><span>MOTORLINE</span><span>Car dealership inventory</span></footer>
    {action && <InventoryDialog action={action} onSave={saveInventory} onClose={() => setAction(null)} />}
  </div>;
}
