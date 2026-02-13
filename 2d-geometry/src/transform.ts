import { Point } from './point';
import { Vector } from './vector';

/**
 * Represents a 2D affine transformation matrix.
 * Stored as a 3x3 matrix where the last row is [0, 0, 1].
 *
 * | a  c  tx |
 * | b  d  ty |
 * | 0  0  1  |
 *
 * Immutable class.
 */
export class Transform {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;

  /**
   * Creates a new Transform.
   * Default is identity matrix.
   */
  constructor(
    a: number = 1,
    b: number = 0,
    c: number = 0,
    d: number = 1,
    tx: number = 0,
    ty: number = 0
  ) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.tx = tx;
    this.ty = ty;
  }

  /**
   * The identity transform.
   */
  static readonly IDENTITY = new Transform();

  /**
   * Creates a translation transform.
   * @param x The x translation.
   * @param y The y translation.
   */
  static translate(x: number, y: number): Transform {
    return new Transform(1, 0, 0, 1, x, y);
  }

  /**
   * Creates a scaling transform.
   * @param sx The x scale factor.
   * @param sy The y scale factor (defaults to sx).
   */
  static scale(sx: number, sy: number = sx): Transform {
    return new Transform(sx, 0, 0, sy, 0, 0);
  }

  /**
   * Creates a rotation transform.
   * @param angle The angle in radians.
   */
  static rotate(angle: number): Transform {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Transform(cos, sin, -sin, cos, 0, 0);
  }

  /**
   * Creates a shearing transform.
   * @param shx The x shear factor.
   * @param shy The y shear factor.
   */
  static shear(shx: number, shy: number): Transform {
    return new Transform(1, shy, shx, 1, 0, 0);
  }

  /**
   * Multiplies this transform by another (concatenation).
   * Result = This * Other (Applied in order: Other then This)
   * Note: Matrix multiplication order matters.
   * Usually transformations are applied right-to-left: T * R * S * point
   * This method returns A * B.
   * @param other The other transform.
   */
  multiply(other: Transform): Transform {
    return new Transform(
      this.a * other.a + this.c * other.b,
      this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d,
      this.b * other.c + this.d * other.d,
      this.a * other.tx + this.c * other.ty + this.tx,
      this.b * other.tx + this.d * other.ty + this.ty
    );
  }

  /**
   * Inverts the transform.
   * @returns The inverse transform.
   * @throws Error if the determinant is zero (not invertible).
   */
  invert(): Transform {
    const det = this.a * this.d - this.b * this.c;
    if (det === 0) {
      throw new Error('Matrix is not invertible');
    }
    const invDet = 1 / det;
    return new Transform(
      this.d * invDet,
      -this.b * invDet,
      -this.c * invDet,
      this.a * invDet,
      (this.c * this.ty - this.d * this.tx) * invDet,
      (this.b * this.tx - this.a * this.ty) * invDet
    );
  }

  /**
   * Applies the transform to a point.
   * @param p The point to transform.
   * @returns The transformed Point.
   */
  transformPoint(p: Point): Point {
    return new Point(this.a * p.x + this.c * p.y + this.tx, this.b * p.x + this.d * p.y + this.ty);
  }

  /**
   * Applies the transform to a vector.
   * Vectors are direction/magnitude only, so translation is ignored.
   * @param v The vector to transform.
   * @returns The transformed Vector.
   */
  transformVector(v: Vector): Vector {
    return new Vector(this.a * v.x + this.c * v.y, this.b * v.x + this.d * v.y);
  }

  /**
   * Returns a string representation.
   */
  toString(): string {
    return `Transform(a:${this.a}, b:${this.b}, c:${this.c}, d:${this.d}, tx:${this.tx}, ty:${this.ty})`;
  }
}
