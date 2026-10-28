import raize from './raize.json';
import impala from './impala.json';
import { parseVehicle } from './catalog';
export { readSelection } from './catalog';
export type { Vehicle, Part, ViewMode } from './catalog';
export const vehicles = [parseVehicle(raize), parseVehicle(impala)];
