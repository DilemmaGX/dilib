/**
 * Represents a 2D vector with x and y components.
 * Vectors represent magnitude and direction, distinct from Points which represent position.
 * This class is immutable.
 */
export class Vector {
  /** The x component of the vector. */
  readonly x: number;
  /** The y component of the vector. */
  readonly y: number;

  /**
   * Creates a new Vector instance.
   * @param x The x component.
   * @param y The y component.
   */
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /**
   * Zero vector (0, 0).
   */
  static readonly ZERO = new Vector(0, 0);

  /**
   * Unit vector pointing right (1, 0).
   */
  static readonly RIGHT = new Vector(1, 0);

  /**
   * Unit vector pointing up (0, 1).
   * Note: In many 2D graphics systems, Y grows downwards. Adjust expectation accordingly.
   */
  static readonly UP = new Vector(0, 1);

  /**
   * Adds another vector to this one.
   * @param v The vector to add.
   * @returns A new Vector representing the sum.
   */
  add(v: Vector): Vector {
    return new Vector(this.x + v.x, this.y + v.y);
  }

  /**
   * Subtracts another vector from this one.
   * @param v The vector to subtract.
   * @returns A new Vector representing the difference.
   */
  sub(v: Vector): Vector {
    return new Vector(this.x - v.x, this.y - v.y);
  }

  /**
   * Multiplies the vector by a scalar value.
   * @param s The scalar to multiply by.
   * @returns A new scaled Vector.
   */
  scale(s: number): Vector {
    return new Vector(this.x * s, this.y * s);
  }

  /**
   * Returns a vector perpendicular to this one (rotated 90° counterclockwise).
   * @returns The perpendicular vector.
   */
  perp(): Vector {
    return new Vector(-this.y, this.x);
  }

  /**
   * Calculates the dot product with another vector.
   * @param v The other vector.
   * @returns The dot product.
   */
  dot(v: Vector): number {
    return this.x * v.x + this.y * v.y;
  }

  /**
   * Calculates the cross product magnitude (2D analog).
   * Equivalent to the z-component of the cross product of 3D vectors.
   * @param v The other vector.
   * @returns The cross product magnitude.
   */
  cross(v: Vector): number {
    return this.x * v.y - this.y * v.x;
  }

  /**
   * Calculates the magnitude (length) of the vector.
   * @returns The magnitude.
   */
  mag(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Calculates the squared magnitude of the vector.
   * Useful for efficient comparisons avoiding square roots.
   * @returns The squared magnitude.
   */
  magSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Returns a normalized copy of this vector (unit vector).
   * @returns A new Vector with magnitude 1.
   * @throws If the vector is zero-length.
   */
  normalize(): Vector {
    const m = this.mag();
    if (m === 0) return Vector.ZERO;
    return this.scale(1 / m);
  }

  /**
   * Calculates the angle between this vector and another.
   * @param v The other vector.
   * @returns The angle in radians.
   */
  angleTo(v: Vector): number {
    const denom = this.mag() * v.mag();
    if (denom === 0) return 0;
    const cos = Math.min(1, Math.max(-1, this.dot(v) / denom));
    return Math.acos(cos);
  }

  /**
   * Projects this vector onto another vector.
   * @param v The target vector.
   * @returns The projection vector.
   */
  projectOnto(v: Vector): Vector {
    const denom = v.magSq();
    if (denom === 0) return Vector.ZERO;
    const scale = this.dot(v) / denom;
    return v.scale(scale);
  }

  /**
   * Rotates the vector by an angle.
   * @param angle The angle in radians.
   * @returns A new rotated Vector.
   */
  rotate(angle: number): Vector {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
  }

  /**
   * Calculates the angle of this vector relative to the positive x-axis.
   * @returns The angle in radians.
   */
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  /**
   * Checks if this vector is equal to another.
   * @param v The other vector.
   * @param epsilon Optional tolerance for floating point comparison.
   * @returns True if components are within epsilon.
   */
  equals(v: Vector, epsilon: number = Number.EPSILON): boolean {
    return Math.abs(this.x - v.x) < epsilon && Math.abs(this.y - v.y) < epsilon;
  }

  /**
   * Returns a string representation of the vector.
   * @returns String formatted as "(x, y)".
   */
  toString(): string {
    return `(${this.x}, ${this.y})`;
  }
}
