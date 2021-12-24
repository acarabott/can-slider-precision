import { Point } from "./Point";
export class Rect {
  public tl: Point;
  public br: Point;

  constructor(x: Point | number, y: Point | number, width?: number, height?: number) {
    if (x instanceof Point && y instanceof Point) {
      this.tl = x;
      this.br = y;
    } else if (
      typeof x === "number" &&
      typeof y === "number" &&
      typeof width === "number" &&
      typeof height === "number"
    ) {
      this.tl = new Point(x, y);
      this.br = new Point(x + width, y + height);
    } else {
      throw new Error("this should never happen");
    }
  }

  get tr() {
    return new Point(this.br.x, this.tl.y);
  }
  get bl() {
    return new Point(this.tl.x, this.br.y);
  }

  get width() {
    return this.br.x - this.tl.x;
  }
  get height() {
    return this.br.y - this.tl.y;
  }
  get drawRect(): [number, number, number, number] {
    return [this.tl.x, this.tl.y, this.width, this.height];
  }
  get copy() {
    return new Rect(this.tl, this.br);
  }

  contains(point: Point) {
    return point.gte(this.tl) && point.lte(this.br);
  }

  toString() {
    return `${this.tl}, ${this.br}`;
  }
}
