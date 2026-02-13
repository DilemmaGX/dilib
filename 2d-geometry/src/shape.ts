import { Point } from './point';

/**
 * Axis-aligned bounding box.
 */
export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Common interface for all 2D shapes.
 */
export interface Shape {
  /**
   * Calculates the area of the shape.
   */
  area(): number;

  /**
   * Calculates the perimeter (boundary length) of the shape.
   */
  perimeter(): number;

  /**
   * Checks if a point is inside or on the boundary of the shape.
   * @param p The point to check.
   */
  contains(p: Point): boolean;

  /**
   * Returns the axis-aligned bounding box of the shape.
   */
  boundingBox(): BoundingBox;
}
