import { Point } from './point';
import { LineSegment } from './line';
import { Shape } from './shape';
import type { BoundingBox } from './shape';
import { Transform } from './transform';

/**
 * Represents a polygon defined by a sequence of vertices.
 * The vertices are assumed to be connected sequentially, with the last connected to the first.
 * Immutable class.
 */
export class Polygon implements Shape {
  /** The vertices of the polygon. */
  readonly vertices: Point[];

  /**
   * Creates a new Polygon.
   * @param vertices An array of points defining the polygon vertices.
   * @throws Error if less than 3 vertices are provided.
   */
  constructor(vertices: Point[]) {
    const normalized = [...vertices];
    if (normalized.length >= 2) {
      const first = normalized[0];
      const last = normalized[normalized.length - 1];
      if (first.equals(last)) normalized.pop();
    }
    if (normalized.length < 3) {
      throw new Error('A polygon must have at least 3 vertices');
    }
    this.vertices = normalized.map((v) => new Point(v.x, v.y));
  }

  /**
   * Creates a regular polygon.
   * @param center The center of the polygon.
   * @param radius The radius (distance from center to vertices).
   * @param sides The number of sides (at least 3).
   * @param startAngle The starting angle in radians (default 0).
   * @returns A new regular Polygon.
   */
  static regular(center: Point, radius: number, sides: number, startAngle: number = 0): Polygon {
    if (sides < 3) {
      throw new Error('A regular polygon must have at least 3 sides');
    }
    const vertices: Point[] = [];
    const angleStep = (2 * Math.PI) / sides;

    for (let i = 0; i < sides; i++) {
      const angle = startAngle + i * angleStep;
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);
      vertices.push(new Point(x, y));
    }

    return new Polygon(vertices);
  }

  /**
   * Returns the edges (line segments) of the polygon.
   */
  edges(): LineSegment[] {
    const edges: LineSegment[] = [];
    const len = this.vertices.length;
    for (let i = 0; i < len; i++) {
      edges.push(new LineSegment(this.vertices[i], this.vertices[(i + 1) % len]));
    }
    return edges;
  }

  /**
   * Calculates the area using the Shoelace formula.
   */
  area(): number {
    let area = 0;
    const len = this.vertices.length;
    for (let i = 0; i < len; i++) {
      const current = this.vertices[i];
      const next = this.vertices[(i + 1) % len];
      area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) / 2;
  }

  /**
   * Calculates the signed area of the polygon.
   * Positive if vertices are counterclockwise, negative if clockwise.
   */
  signedArea(): number {
    let area = 0;
    const len = this.vertices.length;
    for (let i = 0; i < len; i++) {
      const current = this.vertices[i];
      const next = this.vertices[(i + 1) % len];
      area += current.x * next.y - next.x * current.y;
    }
    return area / 2;
  }

  /**
   * Calculates the perimeter (sum of edge lengths).
   */
  perimeter(): number {
    let p = 0;
    const len = this.vertices.length;
    for (let i = 0; i < len; i++) {
      p += this.vertices[i].distanceTo(this.vertices[(i + 1) % len]);
    }
    return p;
  }

  /**
   * Checks if a point is inside the polygon using the ray casting algorithm (even-odd rule).
   * @param p The point to check.
   * @param epsilon Optional tolerance for boundary checks.
   */
  contains(p: Point, epsilon: number = Number.EPSILON): boolean {
    const edges = this.edges();
    for (const edge of edges) {
      if (edge.distanceTo(p) <= epsilon) return true;
    }
    let inside = false;
    const len = this.vertices.length;
    for (let i = 0, j = len - 1; i < len; j = i++) {
      const xi = this.vertices[i].x,
        yi = this.vertices[i].y;
      const xj = this.vertices[j].x,
        yj = this.vertices[j].y;

      const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Calculates the axis-aligned bounding box.
   */
  boundingBox(): BoundingBox {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const v of this.vertices) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * Calculates the centroid (geometric center) of the polygon.
   */
  centroid(): Point {
    let cx = 0,
      cy = 0,
      area = 0;
    const len = this.vertices.length;

    for (let i = 0; i < len; i++) {
      const p0 = this.vertices[i];
      const p1 = this.vertices[(i + 1) % len];
      const cross = p0.x * p1.y - p1.x * p0.y;
      cx += (p0.x + p1.x) * cross;
      cy += (p0.y + p1.y) * cross;
      area += cross;
    }

    area *= 0.5;
    if (Math.abs(area) < Number.EPSILON) {
      let sx = 0,
        sy = 0;
      for (const v of this.vertices) {
        sx += v.x;
        sy += v.y;
      }
      return new Point(sx / len, sy / len);
    }

    const factor = 1 / (6 * area);
    return new Point(cx * factor, cy * factor);
  }

  /**
   * Checks if the polygon is convex.
   */
  isConvex(): boolean {
    const len = this.vertices.length;
    if (len < 3) return false;

    let previousCrossProduct = 0;

    for (let i = 0; i < len; i++) {
      const p1 = this.vertices[i];
      const p2 = this.vertices[(i + 1) % len];
      const p3 = this.vertices[(i + 2) % len];

      const v1 = p2.sub(p1);
      const v2 = p3.sub(p2);

      const crossProduct = v1.cross(v2);

      if (i > 0) {
        if (crossProduct * previousCrossProduct < 0) {
          return false;
        }
      }
      if (crossProduct !== 0) {
        previousCrossProduct = crossProduct;
      }
    }
    return true;
  }

  /**
   * Checks whether this polygon intersects another polygon.
   * @param other The other polygon.
   * @param epsilon Optional tolerance for edge intersection checks.
   * @returns True if polygons intersect or one contains the other.
   */
  intersectsPolygon(other: Polygon, epsilon: number = Number.EPSILON): boolean {
    const edgesA = this.edges();
    const edgesB = other.edges();

    for (const edgeA of edgesA) {
      for (const edgeB of edgesB) {
        if (edgeA.intersects(edgeB, epsilon)) return true;
      }
    }

    return this.contains(other.vertices[0], epsilon) || other.contains(this.vertices[0], epsilon);
  }

  /**
   * Applies a transform to the polygon and returns a new polygon.
   * @param transform The transform to apply.
   * @returns The transformed polygon.
   */
  transform(transform: Transform): Polygon {
    return new Polygon(this.vertices.map((v) => transform.transformPoint(v)));
  }

  /**
   * Transforms the polygon using a translation vector.
   */
  translate(dx: number, dy: number): Polygon {
    return new Polygon(this.vertices.map((v) => new Point(v.x + dx, v.y + dy)));
  }

  /**
   * Returns a string representation.
   */
  toString(): string {
    return `Polygon(vertices: ${this.vertices.length})`;
  }
}
