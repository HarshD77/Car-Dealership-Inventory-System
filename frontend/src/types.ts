export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
}
export interface Session {
  token: string;
  user: User;
}
export interface Vehicle {
  id: string;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
}
export type VehicleInput = Omit<Vehicle, 'id'>;
