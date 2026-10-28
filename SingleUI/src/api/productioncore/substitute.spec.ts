import { ServiceRequestError } from '../http/request';
import { ProductionCoreSubstitute } from './substitute';

describe('ProductionCore substitute', () => {
  it('provides generic local sample services without performing network checks', async () => {
    const api = new ProductionCoreSubstitute('default');
    const targets = await api.targets();
    expect(targets).toHaveLength(4);
    expect(targets.every((target) => target.id.startsWith('sample-'))).toBe(true);
    expect(targets.some((target) => target.up)).toBe(true);
    expect(targets.some((target) => !target.up)).toBe(true);
  });

  it('supports empty, signed-out, failure and loading scenarios', async () => {
    await expect(new ProductionCoreSubstitute('empty').targets()).resolves.toEqual([]);
    await expect(new ProductionCoreSubstitute('signed-out').targets()).resolves.toHaveLength(4);
    await expect(new ProductionCoreSubstitute('failure').targets()).rejects.toBeInstanceOf(
      ServiceRequestError,
    );
    const result = await Promise.race([
      new ProductionCoreSubstitute('loading').targets(),
      new Promise((resolve) => setTimeout(() => resolve('pending'), 20)),
    ]);
    expect(result).toBe('pending');
  });
});
