// prevent mobile scrolling
document.ontouchmove = function(event){ event.preventDefault(); }

class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  gte(point) {
    return this.x >= point.x && this.y >= point.y;
  }

  lte(point) {
    return this.x <= point.x && this.y <= point.y;
  }

  *[Symbol.iterator]() { yield this.x; yield this.y; }
}

class Rect {
  constructor(x, y, width, height) {
    if (x instanceof Point) {
      this.tl = x;
      this.br = y;
    }
    else {
      this.tl = new Point(x, y);
      this.br = new Point(x + width, y + height);
    }
  }

  width() { return this.br.x - this.tl.x; }
  height() { return this.br.y - this.tl.y; }

  contains(point) {
    return point.gte(this.tl) && point.lte(this.br);
  }

  drawRect() {
    return [...this.tl, this.width(), this.height()];
  }
}

class Slider {
  constructor(type = 'vert', long = 300, short = 50) {
    this.isVert = type === 'vert';
    this.long = long;
    this.short = short;

    this.valueMin = 0.0;
    this.valueMax = 1.0;
    this.value = 0.5;

    this.active = false;

    this.canvas = document.createElement('canvas');
    this.canvas.height = type === 'vert' ? long : short;
    this.canvas.width = type === 'vert' ? short : long;
    this.canvas.style.cursor = 'pointer';
    this.canvas.style.userSelect = 'none';
    this.ctx = this.canvas.getContext('2d');
    this.canvasHammer = new Hammer(this.canvas);

    this.canvasHammer.get('pan').set({ direction: Hammer.DIRECTION_ALL, threshold: 0 });
    this.canvasHammer.on('hammer.input', event => {
      this.render();
    });
    this.canvasHammer.on('tap', event => {
    });

    this.canvasHammer.on('panstart panend pancancel', event => {});
    Hammer.on(this.canvas, 'mousedown touchstart', event => {
      const bb = event.target.getBoundingClientRect();
      const point = new Point(event.pageX - bb.left, event.pageY - bb.top);
      this.active = this.getHandleRect().contains(point);
      this.render();
    });
    Hammer.on(this.canvas, 'mouseup touchend', event => {
      this.active = false;
      this.render();
    })
  }

  getOrientationValue(twoOptions) {
    return twoOptions.slice()[this.isVert ? 'valueOf' : 'reverse']();
  }

  getHandleRect() {
    const inRange = this.valueMax - this.valueMin;
    const outRange = this.valueMax - this.valueMin;
    const pos = ((this.value - this.valueMin) / inRange) * (outRange + this.valueMin);
    const origDims = [this.short, 8];
    const tl = this.getOrientationValue([this.short * 0.5 - (origDims[0] / 2),
                                         this.long * pos - (origDims[1] / 2)]);
    const dims = this.getOrientationValue(origDims);

    return new Rect(...tl, ...dims);
  }

  render() {
    const can = this.canvas;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, can.width, can.height);

    ctx.save();
    // line
    {
      ctx.fillStyle = '#000';
      const thickness = Math.max(1, this.short * 0.04);
      const pos = this.short * 0.5 - (thickness / 2);
      const xy = this.getOrientationValue([pos, 0]);
      const dims = this.getOrientationValue([thickness, this.long]);
      ctx.fillRect(...xy, ...dims);
    }

    // handle
    // linlin
    {
      ctx.fillStyle = `rgba(43, 156, 212, ${this.active ? 1.0 : 0.5})`;
      ctx.fillRect(...this.getHandleRect().drawRect());
    }

    ctx.restore();
  }

  appendTo(domNode) {
    domNode.appendChild(this.canvas);
    this.render();
  }

}

const box = document.getElementById('container');
const vert = new Slider('vert');
vert.appendTo(box);

const horz = new Slider('horz');
horz.appendTo(box);


// approaches
// 1. modifier keys
// 2. vertical slider
