'use client';
import { createContext, useContext } from 'react';
import type { Point, State } from '@/lib/milk/model';
export type RoadRoute = {
  coordinates: [number, number][];
  distanceMeters: number;
  travelTimeSeconds: number;
  order: string[];
  attachedStops: Point[];
  algorithm: string;
  optimized: boolean;
};
type Context = {
  state: State;
  save: (s: State) => void;
  calculate: (
    trip: State['trips'][number],
    optimize?: boolean,
  ) => Promise<RoadRoute>;
  message: string;
  notify: (s: string) => void;
};
export const MilkContext = createContext<Context | null>(null);
export function useMilk() {
  const value = useContext(MilkContext);
  if (!value) throw Error('Dados ainda não disponíveis.');
  return value;
}
