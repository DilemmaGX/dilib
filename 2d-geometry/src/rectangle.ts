import { Point } from './point';
import { Polygon } from './polygon';

/**
 * Represents an axis-aligned rectangle.
 * Defined by its top-left corner (min x, min y), width, and height.
 * Immutable class.
 */
export class Rectangle extends Polygon {
  /** The x-coordinate of the top-left corner. */
  readonly x: number;
  /** The y-coordinate of the top-left corner. */
  readonly y: number;
  /** The width of the rectangle. */
  readonly width: number;
  /** The height of the rectangle. */
  readonly height: number;

  /**
   * Creates a new Rectangle.
   * @param x The x-coordinate of the top-left corner.
   * @param y The y-coordinate of the top-left corner.
   * @param width The width (must be non-negative).
   * @param height The height (must be non-negative).
   * @throws Error if width or height is negative.
   */
  constructor(x: number, y: number, width: number, height: number) {
    if (width < 0 || height < 0) {
      throw new Error('Width and height cannot be negative');
    }
    super([
      new Point(x, y),
      new Point(x + width, y),
      new Point(x + width, y + height),
      new Point(x, y + height),
    ]);
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /**
   * Creates a Rectangle from two points (min and max).
   * @param p1 The first point.
   * @param p2 The second point.
   * @returns A new Rectangle bounding p1 and p2.
   */
  static fromPoints(p1: Point, p2: Point): Rectangle {
    const minX = Math.min(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxX = Math.max(p1.x, p2.x);
    const maxY = Math.max(p1.y, p2.y);
    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  /**
   * The top-left corner (min x, min y).
   */
  get topLeft(): Point {
    return new Point(this.x, this.y);
  }

  /**
   * The bottom-right corner (max x, max y).
   */
  get bottomRight(): Point {
    return new Point(this.x + this.width, this.y + this.height);
  }

  /**
   * The center point of the rectangle.
   */
  get center(): Point {
    return new Point(this.x + this.width / 2, this.y + this.height / 2);
  }

  /**
   * The minimum x coordinate.
   */
  get left(): number {
    return this.x;
  }

  /**
   * The maximum x coordinate.
   */
  get right(): number {
    return this.x + this.width;
  }

  /**
   * The minimum y coordinate.
   */
  get top(): number {
    return this.y;
  }

  /**
   * The maximum y coordinate.
   */
  get bottom(): number {
    return this.y + this.height;
  }

  /**
   * Calculates the area of the rectangle.
   */
  override area(): number {
    return this.width * this.height;
  }

  /**
   * Calculates the perimeter of the rectangle.
   */
  override perimeter(): number {
    return 2 * (this.width + this.height);
  }

  /**
   * Checks if a point is inside or on the boundary of the rectangle.
   * @param p The point to check.
   * @returns True if contained.
   */
  override contains(p: Point): boolean {
    return (
      p.x >= this.x && p.x <= this.x + this.width && p.y >= this.y && p.y <= this.y + this.height
    );
  }

  /**
   * Calculates the axis-aligned bounding box.
   * For a Rectangle, this returns itself.
   */
  override boundingBox(): Rectangle {
    return this;
  }

  /**
   * Checks if this rectangle intersects with another.
   * @param other The other rectangle.
   * @returns True if they intersect.
   */
  intersects(other: Rectangle): boolean {
    return (
      this.x < other.x + other.width &&
      this.x + this.width > other.x &&
      this.y < other.y + other.height &&
      this.y + this.height > other.y
    );
  }

  /**
   * Returns the intersection rectangle of two rectangles.
   * @param other The other rectangle.
   * @returns The intersection Rectangle, or null if no intersection.
   */
  intersection(other: Rectangle): Rectangle | null {
    if (!this.intersects(other)) return null;

    const minX = Math.max(this.x, other.x);
    const minY = Math.max(this.y, other.y);
    const maxX = Math.min(this.x + this.width, other.x + other.width);
    const maxY = Math.min(this.y + this.height, other.y + other.height);

    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  /**
   * Returns the smallest rectangle containing both rectangles (union).
   * @param other The other rectangle.
   * @returns The union Rectangle.
   */
  union(other: Rectangle): Rectangle {
    const minX = Math.min(this.x, other.x);
    const minY = Math.min(this.y, other.y);
    const maxX = Math.max(this.x + this.width, other.x + other.width);
    const maxY = Math.max(this.y + this.height, other.y + other.height);

    return new Rectangle(minX, minY, maxX - minX, maxY - minY);
  }

  /**
   * Returns a string representation.
   */
  override toString(): string {
    return `Rectangle(x: ${this.x}, y: ${this.y}, w: ${this.width}, h: ${this.height})`;
  }
}
