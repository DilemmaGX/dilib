import { Point } from './point';
import { Shape } from './shape';
import { Rectangle } from './rectangle';
import { Polygon } from './polygon';

/**
 * Represents a circle defined by a center point and a radius.
 * Immutable class.
 */
export class Circle implements Shape {
  /** The center point of the circle. */
  readonly center: Point;
  /** The radius of the circle. */
  readonly radius: number;

  /**
   * Creates a new Circle.
   * @param center The center point.
   * @param radius The radius (must be non-negative).
   * @throws Error if radius is negative.
   */
  constructor(center: Point, radius: number) {
    if (radius < 0) {
      throw new Error('Radius cannot be negative');
    }
    this.center = center;
    this.radius = radius;
  }

  /**
   * Calculates the area of the circle.
   * @returns The area (π * r²).
   */
  area(): number {
    return Math.PI * this.radius * this.radius;
  }

  /**
   * Calculates the circumference of the circle.
   * @returns The circumference (2 * π * r).
   */
  circumference(): number {
    return 2 * Math.PI * this.radius;
  }

  /**
   * Alias for circumference to satisfy Shape interface.
   * @returns The perimeter/circumference.
   */
  perimeter(): number {
    return this.circumference();
  }

  /**
   * Checks if a point is inside or on the boundary of the circle.
   * @param p The point to check.
   * @returns True if the point is contained.
   */
  contains(p: Point): boolean {
    return this.center.distanceToSq(p) <= this.radius * this.radius;
  }

  /**
   * Calculates the axis-aligned bounding box of the circle.
   */
  boundingBox(): Rectangle {
    return new Rectangle(
      this.center.x - this.radius,
      this.center.y - this.radius,
      this.radius * 2,
      this.radius * 2
    );
  }

  /**
   * Approximates the circle as a regular polygon.
   * @param segments The number of segments (vertices) for the polygon.
   * @returns A regular Polygon approximating the circle.
   */
  toPolygon(segments: number = 32): Polygon {
    return Polygon.regular(this.center, this.radius, segments);
  }

  /**
   * Checks if this circle intersects with another circle.
   * @param other The other circle.
   * @returns True if they intersect or one is inside the other.
   */
  intersects(other: Circle): boolean {
    const distanceSq = this.center.distanceToSq(other.center);
    const radiusSum = this.radius + other.radius;
    return distanceSq <= radiusSum * radiusSum;
  }

  /**
   * Checks whether this circle intersects a polygon.
   * @param polygon The polygon to test.
   * @param epsilon Optional tolerance for boundary checks.
   * @returns True if they intersect.
   */
  intersectsPolygon(polygon: Polygon, epsilon: number = Number.EPSILON): boolean {
    if (polygon.contains(this.center, epsilon)) return true;
    for (const v of polygon.vertices) {
      if (this.center.distanceToSq(v) <= (this.radius + epsilon) ** 2) return true;
    }
    for (const edge of polygon.edges()) {
      if (edge.distanceTo(this.center) <= this.radius + epsilon) return true;
    }
    return false;
  }

  /**
   * Returns a string representation of the circle.
   * @returns String formatted as "Circle(center: (x, y), radius: r)".
   */
  toString(): string {
    return `Circle(center: ${this.center.toString()}, radius: ${this.radius})`;
  }
}
