// prevent mobile scrolling
document.ontouchmove = function(event){ event.preventDefault(); };

class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  gte(point) { return this.x >= point.x && this.y >= point.y; }
  lte(point) { return this.x <= point.x && this.y <= point.y; }

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

  get tr() { return new Point(this.br.x, this.tl.y); }
  get bl() { return new Point(this.tl.x, this.br.y); }

  get width() { return this.br.x - this.tl.x; }
  get height() { return this.br.y - this.tl.y; }
  get drawRect() { return [...this.tl, this.width, this.height]; }

  contains(point) { return point.gte(this.tl) && point.lte(this.br); }
}

class SliderPrecision {
  constructor(type = 'vert', long = 300, short = 50) {
    this.isVert = type === 'vert';
    this.long = long;
    this.short = short;
    this.shortExtra = short * 3;
    this.handleDim = 40;

    this.valueMin = 0.0;
    this.valueMax = 1.0;
    this.value = 0.5;

    this.active = false;
    this.isTouch = false;

    this.canvas = document.createElement('canvas');
    this.canvas.height = type === 'vert' ? this.long : this.shortExtra;
    this.canvas.width = type === 'vert' ? this.shortExtra : this.long;
    this.canvas.style.cursor = 'pointer';
    this.canvas.style.userSelect = 'none';
    this.ctx = this.canvas.getContext('2d');
    this.canvasHammer = new Hammer(this.canvas);

    Hammer.on(this.canvas, 'mousedown touchstart', event => {
      const point = this.getInputPoint(event);
      this.active = this.getHandleRect(this.value).contains(point);
      this.render();
    });

    Hammer.on(this.canvas, 'mouseup touchend', event => {
      this.active = false;
      this.render();
    });

    this.canvasHammer.on('hammer.input', event => {
      this.isTouch = event.pointerType === 'touch';
      this.render();
    });

    this.canvasHammer.get('pan').set({
      direction: Hammer.DIRECTION_ALL, threshold: 10
    });

    this.canvasHammer.on('panmove', event => {
      if (this.active) {
        this.value = this.calculatePosition(event);
        this.updateValue();
      }
      this.render();
    });

    this.canvasHammer.on('press', event => {});
    this.canvasHammer.on('doubletap', event => {});
  }

  getInputPoint(event) {
    const bb = event.target.getBoundingClientRect();
    return new Point(event.clientX - bb.left, event.clientY - bb.top);
  }

  calculatePosition(event) {
    const bb = event.target.getBoundingClientRect();
    const x = event.hasOwnProperty('center') ? event.center.x : event.pageX;
    const y = event.hasOwnProperty('center') ? event.center.y : event.pageY;
    const longVal = this.isVert ? y - bb.top : x - bb.left;
    const v = Math.min(Math.max(0, longVal), this.long);
    return v / this.long;
  }

  getOrientationValue(twoOptions) {
    return twoOptions.slice()[this.isVert ? 'valueOf' : 'reverse']();
  }

  getHandleRect(value, dimension = this.handleDim, extended = this.active && this.isTouch) {
    const inRange = this.valueMax - this.valueMin;
    const outRange = this.valueMax - this.valueMin;
    const pos =  ((value - this.valueMin) / inRange) * (outRange + this.valueMin);
    const origDims = [this.short, dimension];
    const tl = this.getOrientationValue([this.short * 1.5 - (origDims[0] / 2),
                                         this.long * pos - (origDims[1] / 2)]);
    const dims = this.getOrientationValue(origDims);
    const rect = new Rect(...tl, ...dims);
    return extended ? this.getExtendedRect(rect) : rect;
  }

  render() {
    const can = this.canvas;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, can.width, can.height);

    ctx.save();

    // line
    {
      ctx.fillStyle = '#000';
      const thickness = 1;
      const pos = this.short * 1.5 - (thickness / 2);
      const xy = this.getOrientationValue([pos, 0]);
      const dims = this.getOrientationValue([thickness, this.long]);
      ctx.fillRect(...xy, ...dims);
    }

    // handle
    {
      const opacity = this.active ? 0.8 : 0.5;
      ctx.fillStyle = `rgba(43, 156, 212, ${opacity})`;

      const handleRect = this.getHandleRect(this.value, this.handleDim);
      ctx.fillRect(...handleRect.drawRect);

      ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
      const middleRect = this.getHandleRect(this.value, 2);
      ctx.fillRect(...middleRect.drawRect);

    }

    ctx.restore();
  }

  updateValue() {
    if (this.output !== undefined) { this.output.value = this.value; }
  }

  appendTo(domNode) {
    domNode.appendChild(this.canvas);
    this.render();
  }

  setOutput(domNode) {
    this.output = domNode;
    this.updateValue();
  }
}

function createOutput(input, parent = document.body) {
  const output = document.createElement('input');
  output.classList.add('output');
  parent.appendChild(output);
  input.setOutput(output);
}

const box = document.getElementById('container');
const vert = new SliderPrecision('vert');
vert.appendTo(box);
createOutput(vert, box);

const horz = new SliderPrecision('horz');
horz.appendTo(box);
createOutput(horz, box);

// approaches
// 1. modifier keys
// 2. vertical slider
