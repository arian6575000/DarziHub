import type { Order, OrderItem } from '../db/types';

export function calcOrder(o: { items?: Partial<OrderItem>[]; discount?: number | string }) {
  const items = o.items || [];
  const subtotal = items.reduce(
    (s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0) + (Number(i.fabricAmount) || 0), 0);
  const discount = Number(o.discount) || 0;
  return { subtotal, discount, total: Math.max(0, subtotal - discount) };
}
export const itemAmount = (i: OrderItem) => (Number(i.qty) || 0) * (Number(i.rate) || 0) + (Number(i.fabricAmount) || 0);
export type { Order };
