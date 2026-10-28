import { vehicles } from '../cars';
import {
  createVehicleItems,
  itemLabel,
  searchItemTree,
  subtreeIds,
  validateItems,
  worldPosition,
} from './items';
import { engineLessons } from './studies';
import { lessonFor } from './engine-lessons';

describe('Original car item hierarchy', () => {
  const raize = vehicles.find((car) => car.id === 'raize')!;
  const tree = createVehicleItems(raize);
  it('finds nested study aliases, related subjects and distinct occurrences', () => {
    expect(
      searchItemTree(tree, raize, engineLessons, 'piston').some(
        (result) => result.itemId === 'engine-piston-study',
      ),
    ).toBe(true);
    const wheel = tree.items.find((item) => item.id === 'wheel-front-left')!;
    expect(itemLabel(tree, wheel)).toContain('front left');
    for (const id of ['engine', 'intake', 'lubrication', 'engine-piston-study'])
      expect(subtreeIds(tree, 'engine').has(id)).toBe(true);
    expect(
      worldPosition(
        tree,
        tree.items.find((item) => item.id === 'wiper-rubber-left')!,
      )[1],
    ).toBeCloseTo(1.185);
    expect(lessonFor(engineLessons, 'raize', 'engine-piston-study').status).toBe('ready');
    expect(
      createVehicleItems(vehicles.find((car) => car.id === 'impala')!).items.some(
        (item) => item.id === 'engine-piston-study',
      ),
    ).toBe(false);
  });
  it('rejects broken parents and cycles rather than rendering a partial tree', () => {
    const broken = {
      ...tree,
      items: tree.items.map((item) =>
        item.id === 'engine' ? { ...item, parentId: 'missing' } : item,
      ),
    };
    expect(() => validateItems(broken)).toThrow(/Unknown parent/);
    expect(() =>
      validateItems({
        ...tree,
        items: tree.items.map((item) =>
          item.id === 'engine' ? { ...item, parentId: 'engine-piston-study' } : item,
        ),
      }),
    ).toThrow(/cycle/);
  });
});
