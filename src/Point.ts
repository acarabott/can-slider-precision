export class Point {
  public x: number;
  public y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  gte(point: Point) {
    return this.x >= point.x && this.y >= point.y;
  }
  lte(point: Point) {
    return this.x <= point.x && this.y <= point.y;
  }

  *[Symbol.iterator]() {
    yield this.x;
    yield this.y;
  }

  toString() {
    return `${this.x.toFixed(0)}, ${this.y.toFixed(0)}`;
  }

  subtract(pointOrX: Point | number, y: number) {
    const args: [number, number] =
      pointOrX instanceof Point
        ? [this.x - pointOrX.x, this.y - pointOrX.y]
        : [this.x - pointOrX, this.y - y];
    return new Point(...args);
  }

  add(pointOrX: Point | number, y: number) {
    const args: [number, number] =
      pointOrX instanceof Point
        ? [this.x + pointOrX.x, this.y + pointOrX.y]
        : [this.x + pointOrX, this.y + y];
    return new Point(...args);
  }
}
