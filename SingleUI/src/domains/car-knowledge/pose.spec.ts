import { describe, expect, it } from 'vitest';
import { Euler, Quaternion } from 'three';
import { fieldsToPose, poseToFields } from './pose';

describe('placement pose fields', () => {
  it('matches three.js Y-X-Z Euler order and stays a unit quaternion', () => {
    const fields = { x: 0.2, y: 0.45, z: 1.3, yaw: 90, pitch: 10, roll: -5 };
    const pose = fieldsToPose(fields);
    const expected = new Quaternion().setFromEuler(new Euler(10 * Math.PI / 180, Math.PI / 2, -5 * Math.PI / 180, 'YXZ'));
    expect(pose.qx).toBeCloseTo(expected.x, 9);
    expect(pose.qy).toBeCloseTo(expected.y, 9);
    expect(pose.qz).toBeCloseTo(expected.z, 9);
    expect(pose.qw).toBeCloseTo(expected.w, 9);
    expect(Math.hypot(pose.qx, pose.qy, pose.qz, pose.qw)).toBeCloseTo(1, 9);
    expect(pose).toMatchObject({ x: 0.2, y: 0.45, z: 1.3 });
  });

  it('round-trips typed fields and keeps identity at zero', () => {
    const fields = { x: -0.75, y: 0, z: 2.1, yaw: -135, pitch: 30, roll: 12.5 };
    expect(poseToFields(fieldsToPose(fields))).toEqual(fields);
    expect(fieldsToPose({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 }))
      .toEqual({ x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 });
  });

  it('reads a straight-up pitch without inventing roll', () => {
    const fields = poseToFields(fieldsToPose({ x: 0, y: 0, z: 0, yaw: 40, pitch: 90, roll: 0 }));
    expect(fields.pitch).toBeCloseTo(90, 2);
    expect(fields.roll).toBe(0);
  });
});
