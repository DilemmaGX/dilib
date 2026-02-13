import { Point } from './point';
import { Vector } from './vector';

/**
 * Represents a finite line segment defined by two points.
 * Immutable class.
 */
export class LineSegment {
  /** The starting point of the segment. */
  readonly start: Point;
  /** The ending point of the segment. */
  readonly end: Point;

  /**
   * Creates a new LineSegment.
   * @param start The starting point.
   * @param end The ending point.
   */
  constructor(start: Point, end: Point) {
    this.start = start;
    this.end = end;
  }

  /**
   * Calculates the length of the segment.
   * @returns The length.
   */
  length(): number {
    return this.start.distanceTo(this.end);
  }

  /**
   * Calculates the squared length of the segment.
   * @returns The squared length.
   */
  lengthSq(): number {
    return this.start.distanceToSq(this.end);
  }

  /**
   * Returns the vector from start to end.
   * @returns The displacement vector.
   */
  toVector(): Vector {
    return this.end.sub(this.start);
  }

  /**
   * Returns the direction unit vector of the segment.
   * @returns The normalized direction vector.
   */
  direction(): Vector {
    return this.toVector().normalize();
  }

  /**
   * Calculates the midpoint of the segment.
   * @returns The midpoint.
   */
  midpoint(): Point {
    const v = this.toVector().scale(0.5);
    return this.start.add(v);
  }

  /**
   * Finds the closest point on the segment to a given point.
   * @param p The query point.
   * @returns The closest point on the segment.
   */
  closestPoint(p: Point): Point {
    const segmentVector = this.toVector();
    const lengthSq = segmentVector.magSq();

    if (lengthSq === 0) return this.start;

    const pointVector = p.sub(this.start);
    const t = pointVector.dot(segmentVector) / lengthSq;

    const tClamped = Math.max(0, Math.min(1, t));

    return this.start.add(segmentVector.scale(tClamped));
  }

  /**
   * Calculates the distance from a point to the segment.
   * @param p The query point.
   * @returns The distance.
   */
  distanceTo(p: Point): number {
    return this.closestPoint(p).distanceTo(p);
  }

  /**
   * Checks whether this segment intersects another segment.
   * @param other The other segment.
   * @param epsilon Optional tolerance for collinearity and boundary checks.
   * @returns True if the segments intersect.
   */
  intersects(other: LineSegment, epsilon: number = Number.EPSILON): boolean {
    const p1 = this.start;
    const q1 = this.end;
    const p2 = other.start;
    const q2 = other.end;

    const o1 = LineSegment.orientation(p1, q1, p2);
    const o2 = LineSegment.orientation(p1, q1, q2);
    const o3 = LineSegment.orientation(p2, q2, p1);
    const o4 = LineSegment.orientation(p2, q2, q1);

    if (LineSegment.isCollinear(o1, epsilon) && LineSegment.onSegment(p1, p2, q1, epsilon)) {
      return true;
    }
    if (LineSegment.isCollinear(o2, epsilon) && LineSegment.onSegment(p1, q2, q1, epsilon)) {
      return true;
    }
    if (LineSegment.isCollinear(o3, epsilon) && LineSegment.onSegment(p2, p1, q2, epsilon)) {
      return true;
    }
    if (LineSegment.isCollinear(o4, epsilon) && LineSegment.onSegment(p2, q1, q2, epsilon)) {
      return true;
    }

    return o1 * o2 < 0 && o3 * o4 < 0;
  }

  /**
   * Computes the intersection point of two segments.
   * @param other The other segment.
   * @param epsilon Optional tolerance for parallel checks and bounds.
   * @returns The intersection point, or null if none.
   */
  intersectionPoint(other: LineSegment, epsilon: number = Number.EPSILON): Point | null {
    const x1 = this.start.x;
    const y1 = this.start.y;
    const x2 = this.end.x;
    const y2 = this.end.y;
    const x3 = other.start.x;
    const y3 = other.start.y;
    const x4 = other.end.x;
    const y4 = other.end.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) <= epsilon) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / denom;

    if (t < -epsilon || t > 1 + epsilon || u < -epsilon || u > 1 + epsilon) return null;

    const ix = x1 + t * (x2 - x1);
    const iy = y1 + t * (y2 - y1);

    return new Point(ix, iy);
  }

  /**
   * Returns the orientation cross product of triangle (a, b, c).
   */
  private static orientation(a: Point, b: Point, c: Point): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  /**
   * Checks whether a cross product value is within an epsilon of zero.
   */
  private static isCollinear(value: number, epsilon: number): boolean {
    return Math.abs(value) <= epsilon;
  }

  /**
   * Checks whether point b lies on segment ac within an epsilon.
   */
  private static onSegment(a: Point, b: Point, c: Point, epsilon: number): boolean {
    return (
      b.x >= Math.min(a.x, c.x) - epsilon &&
      b.x <= Math.max(a.x, c.x) + epsilon &&
      b.y >= Math.min(a.y, c.y) - epsilon &&
      b.y <= Math.max(a.y, c.y) + epsilon
    );
  }
}
