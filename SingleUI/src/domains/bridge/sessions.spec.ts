import { columnOf } from './sessions';
import { demoSnapshot } from './demo';

it('prioritizes silent sessions and human needs without conflating assignment state', () => {
  const session = demoSnapshot().sessions[1];
  expect(columnOf(session)).toBe('running');
  expect(columnOf({ ...session, silent: true })).toBe('attention');
  expect(
    columnOf({ ...session, state: 'blocked', needs: [{ text: 'Approval', resolver: 'human' }] }),
  ).toBe('attention');
  expect(columnOf({ ...session, state: 'blocked', needs: [] })).toBe('queue');
  expect(columnOf({ ...session, state: 'done' })).toBe('done');
});
