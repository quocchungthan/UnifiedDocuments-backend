import type { PartPose } from '../../contracts/car-assemblies';

/** Placement as people type it: metres in the car's frame (Y up) and degrees. */
export interface PlacementFields {
  x: number;
  y: number;
  z: number;
  /** Turn left/right, about Y. */
  yaw: number;
  /** Tilt nose up/down, about X. */
  pitch: number;
  /** Lean sideways, about Z. */
  roll: number;
}

const DEG = Math.PI / 180;

/** Converts typed fields to a unit-quaternion pose; rotations apply yaw, then pitch, then roll (intrinsic Y-X-Z). */
export function fieldsToPose(fields: PlacementFields): PartPose {
  const [y, x, z] = [fields.yaw * DEG / 2, fields.pitch * DEG / 2, fields.roll * DEG / 2];
  const [cy, sy, cx, sx, cz, sz] = [Math.cos(y), Math.sin(y), Math.cos(x), Math.sin(x), Math.cos(z), Math.sin(z)];
  return {
    x: fields.x,
    y: fields.y,
    z: fields.z,
    qx: round(sx * cy * cz + cx * sy * sz),
    qy: round(cx * sy * cz - sx * cy * sz),
    qz: round(cx * cy * sz - sx * sy * cz),
    qw: round(cx * cy * cz + sx * sy * sz),
  };
}

/** Inverse of {@link fieldsToPose}; angles are rounded to 0.01° and positions to 0.1 mm. */
export function poseToFields(pose: PartPose): PlacementFields {
  const length = Math.hypot(pose.qx, pose.qy, pose.qz, pose.qw) || 1;
  const [qx, qy, qz, qw] = [pose.qx / length, pose.qy / length, pose.qz / length, pose.qw / length];
  const m13 = 2 * (qx * qz + qw * qy);
  const m23 = 2 * (qy * qz - qw * qx);
  const m33 = 1 - 2 * (qx * qx + qy * qy);
  const m21 = 2 * (qx * qy + qw * qz);
  const m22 = 1 - 2 * (qx * qx + qz * qz);
  const m31 = 2 * (qx * qz - qw * qy);
  const m11 = 1 - 2 * (qy * qy + qz * qz);
  const pitch = Math.asin(-Math.min(1, Math.max(-1, m23)));
  const gimbal = Math.abs(m23) >= 0.9999999;
  const yaw = gimbal ? Math.atan2(-m31, m11) : Math.atan2(m13, m33);
  const roll = gimbal ? 0 : Math.atan2(m21, m22);
  return {
    x: metres(pose.x), y: metres(pose.y), z: metres(pose.z),
    yaw: degrees(yaw), pitch: degrees(pitch), roll: degrees(roll),
  };
}

function round(value: number) {
  const rounded = Math.round(value * 1e9) / 1e9;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function metres(value: number) {
  return round(Math.round(value * 1e4) / 1e4);
}

function degrees(radians: number) {
  return round(Math.round(radians / DEG * 100) / 100);
}
