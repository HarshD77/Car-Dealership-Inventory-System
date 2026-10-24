import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const car = {
  id: '123',
  make: 'Volvo',
  model: 'XC60',
  category: 'SUV',
  price: 4890000,
  quantity: 2,
};
const session = {
  token: 'test-token',
  user: { id: 'user-id', email: 'driver@example.com', role: 'user' },
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('admin inventory forms', () => {
  beforeEach(() => {
    sessionStorage.setItem(
      'dealership-session',
      JSON.stringify({ ...session, user: { ...session.user, role: 'admin' } }),
    );
    fetchMock.mockResolvedValueOnce(json([car]));
  });

  it('adds a vehicle with integer-cent pricing and reloads inventory', async () => {
    const added = {
      ...car,
      id: '456',
      make: 'Toyota',
      model: 'Corolla',
      category: 'Sedan',
      price: 2500001,
      quantity: 4,
    };
    fetchMock.mockResolvedValueOnce(json(added, 201)).mockResolvedValueOnce(json([car, added]));
    render(<App />);
    await screen.findByRole('heading', { name: 'XC60' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));
    const dialog = within(screen.getByRole('dialog'));
    for (const [label, value] of [
      ['Make', 'Toyota'],
      ['Model', 'Corolla'],
      ['Category', 'Sedan'],
      ['Price ($)', '25000.01'],
      ['Quantity in stock', '4'],
    ]) {
      await user.clear(dialog.getByLabelText(label));
      await user.type(dialog.getByLabelText(label), value);
    }
    await user.click(dialog.getByRole('button', { name: 'Save vehicle' }));
    expect(await screen.findByRole('heading', { name: 'Corolla' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Vehicle added');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/vehicles');
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({
      make: 'Toyota',
      model: 'Corolla',
      category: 'Sedan',
      price: 2500001,
      quantity: 4,
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('prefills and updates a vehicle with the full replacement contract', async () => {
    const updated = { ...car, model: 'XC90', price: 4000001 };
    fetchMock.mockResolvedValueOnce(json(updated)).mockResolvedValueOnce(json([updated]));
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByLabelText('Price ($)')).toHaveValue('48900.00');
    await user.clear(dialog.getByLabelText('Model'));
    await user.type(dialog.getByLabelText('Model'), 'XC90');
    await user.clear(dialog.getByLabelText('Price ($)'));
    await user.type(dialog.getByLabelText('Price ($)'), '40000.01');
    await user.click(dialog.getByRole('button', { name: 'Save vehicle' }));
    expect(await screen.findByRole('heading', { name: 'XC90' })).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][1]!.method).toBe('PUT');
    const { id: _id, ...input } = updated;
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual(input);
  });

  it('restocks using a positive integer and refreshes stock', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ ...car, quantity: 7 }))
      .mockResolvedValueOnce(json([{ ...car, quantity: 7 }]));
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Restock' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.clear(dialog.getByLabelText('Quantity to add'));
    await user.type(dialog.getByLabelText('Quantity to add'), '5');
    await user.click(dialog.getByRole('button', { name: 'Restock vehicle' }));
    expect(await screen.findByText('7 in stock')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe('/api/vehicles/123/restock');
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({ quantity: 5 });
  });

  it('rejects fractional restock quantities in the form', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Restock' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Quantity to add'), {
      target: { value: '1.5' },
    });
    fireEvent.submit(dialog.querySelector('form')!);
    expect(within(dialog).getByRole('alert')).toHaveTextContent('positive whole number');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('confirms deletion and supports cancelling without deleting', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json([]));
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Volvo XC60');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete vehicle' }),
    );
    expect(await screen.findByText('No vehicles yet')).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][1]!.method).toBe('DELETE');
  });

  it('keeps an unsuccessful edit open with the entered values and an error', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'Admin access required' }, 403));
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Save vehicle' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Admin access required');
    expect(dialog.getByLabelText('Model')).toHaveValue('XC60');
    expect(dialog.getByRole('button', { name: 'Save vehicle' })).toBeEnabled();
  });

  it('prevents duplicate admin mutations while pending', async () => {
    let finish!: (response: Response) => void;
    fetchMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      )
      .mockResolvedValueOnce(json([car]));
    render(<App />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Save vehicle' }),
    );
    const saving = screen.getByRole('button', { name: 'Saving…' });
    expect(saving).toBeDisabled();
    await user.click(saving);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      finish(json(car));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  sessionStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

async function signIn() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email address'), 'driver@example.com');
  await user.type(screen.getByLabelText('Password'), 'correct-horse-42');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

describe('authentication and inventory dashboard', () => {
  it('signs in, requests the real API contract, and shows vehicle information', async () => {
    fetchMock.mockResolvedValueOnce(json(session)).mockResolvedValueOnce(json([car]));
    render(<App />);
    await signIn();
    expect(await screen.findByRole('heading', { name: 'XC60' })).toBeInTheDocument();
    expect(screen.getByText('Volvo')).toBeInTheDocument();
    expect(screen.getByText('$48,900.00')).toBeInTheDocument();
    expect(screen.getByText('SUV')).toBeInTheDocument();
    expect(screen.getByText('2 in stock')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login');
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
      email: 'driver@example.com',
      password: 'correct-horse-42',
    });
    expect(fetchMock.mock.calls[1][1]!.headers).toMatchObject({
      Authorization: 'Bearer test-token',
    });
    expect(screen.queryByRole('button', { name: 'Add vehicle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('registers an account without submitting a role', async () => {
    fetchMock.mockResolvedValueOnce(json(session, 201)).mockResolvedValueOnce(json([]));
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    await user.type(screen.getByLabelText('Email address'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-42');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('No vehicles yet')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/register');
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).not.toHaveProperty('role');
  });

  it('disables sold-out purchases and hides admin controls for regular users', async () => {
    sessionStorage.setItem('dealership-session', JSON.stringify(session));
    fetchMock.mockResolvedValueOnce(json([{ ...car, quantity: 0 }]));
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Out of stock' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restock' })).not.toBeInTheDocument();
  });

  it('shows inventory management controls to admins', async () => {
    sessionStorage.setItem(
      'dealership-session',
      JSON.stringify({ ...session, user: { ...session.user, role: 'admin' } }),
    );
    fetchMock.mockResolvedValueOnce(json([car]));
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Add vehicle' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('shows login errors and lets the user retry', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'Email or password is incorrect' }, 401));
    render(<App />);
    await signIn();
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('prevents duplicate login submissions while pending', async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<App />);
    await signIn();
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(json({ error: 'Try again' }, 500));
    });
  });

  it('combines search fields, converts dollars to cents, and clears filters', async () => {
    sessionStorage.setItem('dealership-session', JSON.stringify(session));
    fetchMock
      .mockResolvedValueOnce(json([car]))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([car]));
    render(<App />);
    await screen.findByRole('heading', { name: 'XC60' });
    const user = userEvent.setup();
    for (const [label, value] of [
      ['Make', 'Volvo'],
      ['Model', 'XC'],
      ['Category', 'SUV'],
      ['Min price ($)', '12.34'],
      ['Max price ($)', '48900'],
    ]) {
      await user.type(screen.getByLabelText(label, { exact: true }), value);
    }
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(await screen.findByText('No matching vehicles')).toBeInTheDocument();
    const query = new URL(String(fetchMock.mock.calls[1][0]), 'http://localhost').searchParams;
    expect(Object.fromEntries(query)).toEqual({
      make: 'Volvo',
      model: 'XC',
      category: 'SUV',
      minPrice: '1234',
      maxPrice: '4890000',
    });
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('heading', { name: 'XC60' })).toBeInTheDocument();
    expect(screen.getByLabelText('Make', { exact: true })).toHaveValue('');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/vehicles');
  });

  it('rejects reversed price ranges before making a request', async () => {
    sessionStorage.setItem('dealership-session', JSON.stringify(session));
    fetchMock.mockResolvedValueOnce(json([]));
    render(<App />);
    await screen.findByText('No vehicles yet');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Min price ($)'), '100');
    await user.type(screen.getByLabelText('Max price ($)'), '10');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Minimum price must not exceed maximum price',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('purchases once, disables requests while pending, and refreshes inventory', async () => {
    sessionStorage.setItem('dealership-session', JSON.stringify(session));
    let finish!: (response: Response) => void;
    fetchMock
      .mockResolvedValueOnce(json([car]))
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      )
      .mockResolvedValueOnce(json([{ ...car, quantity: 1 }]));
    render(<App />);
    const purchase = await screen.findByRole('button', { name: 'Purchase' });
    const user = userEvent.setup();
    await user.click(purchase);
    expect(screen.getByRole('button', { name: 'Purchasing…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Purchasing…' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      finish(json({ ...car, quantity: 1 }));
    });
    expect(await screen.findByText('1 in stock')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Purchased one Volvo XC60');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/vehicles/123/purchase');
    expect(fetchMock.mock.calls[1][1]!.method).toBe('POST');
  });

  it('shows stock conflicts and refreshes stale inventory', async () => {
    sessionStorage.setItem('dealership-session', JSON.stringify(session));
    fetchMock
      .mockResolvedValueOnce(json([car]))
      .mockResolvedValueOnce(json({ error: 'Vehicle is out of stock' }, 409))
      .mockResolvedValueOnce(json([{ ...car, quantity: 0 }]));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Purchase' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Vehicle is out of stock');
    expect(await screen.findByRole('button', { name: 'Out of stock' })).toBeDisabled();
  });

  it('lets the user retry a failed inventory load', async () => {
    sessionStorage.setItem('dealership-session', JSON.stringify(session));
    fetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json([car]));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'XC60' })).toBeInTheDocument();
  });

  it('returns to sign-in on expired sessions and clears stored credentials', async () => {
    sessionStorage.setItem('dealership-session', JSON.stringify(session));
    fetchMock.mockResolvedValueOnce(
      json({ error: 'Invalid or expired authentication token' }, 401),
    );
    render(<App />);
    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem('dealership-session')).toBeNull();
  });

  it('signs out and safely ignores corrupted session storage', async () => {
    sessionStorage.setItem('dealership-session', JSON.stringify(session));
    fetchMock.mockResolvedValueOnce(json([]));
    const view = render(<App />);
    await screen.findByText('No vehicles yet');
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('status')).toHaveTextContent('You have signed out');
    view.unmount();
    sessionStorage.setItem('dealership-session', 'corrupted');
    render(<App />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});
