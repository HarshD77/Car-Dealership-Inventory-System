import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const car = { id: '123', make: 'Volvo', model: 'XC60', category: 'SUV', price: 4890000, quantity: 2 };
const session = { token: 'test-token', user: { id: 'user-id', email: 'driver@example.com', role: 'user' } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' }
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
  await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
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
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ email: 'driver@example.com', password: 'correct-horse-42' });
    expect(fetchMock.mock.calls[1][1]!.headers).toMatchObject({ Authorization: 'Bearer test-token' });
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
    await user.click(screen.getByRole('button', { name: 'Create account', exact: true }));
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
    sessionStorage.setItem('dealership-session', JSON.stringify({ ...session, user: { ...session.user, role: 'admin' } }));
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
    expect(screen.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  });

  it('prevents duplicate login submissions while pending', async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    render(<App />);
    await signIn();
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { finish(json({ error: 'Try again' }, 500)); });
  });
});
