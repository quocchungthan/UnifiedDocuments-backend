import content from './engine-lessons.json';
import { vehicles } from './index';
import { parseEngineLessons } from './engine-lessons';
import { validateEngineLayoutLessons } from './engine-layout';
import { createVehicleItems, validateEngineLessonsAgainstItems } from './items';

const raize = vehicles.find((vehicle) => vehicle.id === 'raize');
if (!raize) throw new Error('The Raize lesson source catalog is unavailable.');
export const engineLessons = parseEngineLessons(content, raize.sources);
validateEngineLayoutLessons(engineLessons);
validateEngineLessonsAgainstItems(engineLessons, createVehicleItems(raize).items);
