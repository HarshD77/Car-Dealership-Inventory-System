import { useState, type FormEvent } from 'react';
import { dollarsToCents } from '../money';

export function SearchForm({ onSearch, disabled }: { onSearch: (query: string) => void; disabled: boolean }) {
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    try {
      for (const field of ['make', 'model', 'category']) {
        const value = String(data.get(field)).trim();
        if (value) query.set(field, value);
      }
      for (const field of ['minPrice', 'maxPrice']) {
        const value = String(data.get(field)).trim();
        if (value) query.set(field, String(dollarsToCents(value)));
      }
      if (query.has('minPrice') && query.has('maxPrice') && Number(query.get('minPrice')) > Number(query.get('maxPrice'))) {
        throw new Error('Minimum price must not exceed maximum price.');
      }
      setError('');
      onSearch(query.toString());
    } catch (failure) { setError((failure as Error).message); }
  }
  return <aside className="filter-panel">
    <div className="filter-heading"><h2>Find your fit</h2><span aria-hidden="true">≡</span></div>
    <p className="muted text-xs mb-6">A few details. The right vehicle.</p>
    <form onSubmit={submit} onReset={() => { setError(''); onSearch(''); }}>
      <fieldset disabled={disabled} className="space-y-4">
        <label className="field">Make<input name="make" maxLength={100} placeholder="e.g. Volvo" /></label>
        <label className="field">Model<input name="model" maxLength={100} placeholder="e.g. XC60" /></label>
        <label className="field">Category<input name="category" maxLength={100} placeholder="e.g. SUV" /></label>
        <div className="filter-divider" />
        <p className="text-xs font-semibold">Price range <span className="muted font-normal">· USD</span></p>
        <div className="grid grid-cols-2 gap-3">
          <label className="field">Min price ($)<input name="minPrice" inputMode="decimal" placeholder="0.00" /></label>
          <label className="field">Max price ($)<input name="maxPrice" inputMode="decimal" placeholder="Any" /></label>
        </div>
        {error && <p role="alert" className="error-box">{error}</p>}
        <button className="button button-primary w-full" disabled={disabled}>Apply filters</button>
        <button type="reset" className="button button-secondary w-full" disabled={disabled}>Clear filters</button>
      </fieldset>
    </form>
    <p className="filter-note">All vehicles are shown, including those currently out of stock.</p>
  </aside>;
}
