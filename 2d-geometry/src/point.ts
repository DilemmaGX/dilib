import { Vector } from './vector';

/**
 * Represents a point in 2D space.
 * Points represent a position, distinct from Vectors which represent displacement.
 * This class is immutable.
 */
export class Point {
  /** The x coordinate. */
  readonly x: number;
  /** The y coordinate. */
  readonly y: number;

  /**
   * Creates a new Point instance.
   * @param x The x coordinate.
   * @param y The y coordinate.
   */
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /**
   * Origin point (0, 0).
   */
  static readonly ORIGIN = new Point(0, 0);

  /**
   * Adds a vector to this point to get a new point.
   * Point + Vector = Point
   * @param v The vector to add.
   * @returns A new Point translated by the vector.
   */
  add(v: Vector): Point {
    return new Point(this.x + v.x, this.y + v.y);
  }

  /**
   * Subtracts another point from this point to get a displacement vector.
   * Point - Point = Vector
   * @param p The other point.
   * @returns The vector pointing from p to this point.
   */
  sub(p: Point): Vector;
  /**
   * Subtracts a vector from this point to get a new point.
   * Point - Vector = Point
   * @param v The vector to subtract.
   * @returns A new Point translated by the inverse of the vector.
   */
  sub(v: Vector): Point;
  sub(other: Point | Vector): Point | Vector {
    if (other instanceof Point) {
      return new Vector(this.x - other.x, this.y - other.y);
    } else {
      return new Point(this.x - other.x, this.y - other.y);
    }
  }

  /**
   * Creates a vector from this point to another point.
   * @param p The destination point.
   * @returns The vector pointing from this point to p.
   */
  vectorTo(p: Point): Vector {
    return new Vector(p.x - this.x, p.y - this.y);
  }

  /**
   * Linearly interpolates between this point and another point.
   * @param p The target point.
   * @param t Interpolation factor in [0, 1].
   * @returns The interpolated point.
   */
  lerp(p: Point, t: number): Point {
    return new Point(this.x + (p.x - this.x) * t, this.y + (p.y - this.y) * t);
  }

  /**
   * Calculates the Euclidean distance to another point.
   * @param p The other point.
   * @returns The distance.
   */
  distanceTo(p: Point): number {
    const dx = this.x - p.x;
    const dy = this.y - p.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculates the squared Euclidean distance to another point.
   * Useful for efficient comparisons.
   * @param p The other point.
   * @returns The squared distance.
   */
  distanceToSq(p: Point): number {
    const dx = this.x - p.x;
    const dy = this.y - p.y;
    return dx * dx + dy * dy;
  }

  /**
   * Checks if this point is equal to another.
   * @param p The other point.
   * @param epsilon Optional tolerance for floating point comparison.
   * @returns True if coordinates are within epsilon.
   */
  equals(p: Point, epsilon: number = Number.EPSILON): boolean {
    return Math.abs(this.x - p.x) < epsilon && Math.abs(this.y - p.y) < epsilon;
  }

  /**
   * Returns a string representation of the point.
   * @returns String formatted as "(x, y)".
   */
  toString(): string {
    return `(${this.x}, ${this.y})`;
  }
}
