import { Point } from "./Point";
export class Rect {
  constructor(x, y, width, height) {
    if (x instanceof Point) {
      this.tl = x;
      this.br = y;
    } else {
      this.tl = new Point(x, y);
      this.br = new Point(x + width, y + height);
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
  get drawRect() {
    return [...this.tl, this.width, this.height];
  }
  get copy() {
    return new Rect(this.tl, this.br);
  }

  contains(point) {
    return point.gte(this.tl) && point.lte(this.br);
  }

  toString() {
    return `${this.tl}, ${this.br}`;
  }
}
