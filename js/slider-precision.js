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

  get width() { return this.br.x - this.tl.x; }
  get height() { return this.br.y - this.tl.y; }
  get drawRect() { return [...this.tl, this.width, this.height]; }

  contains(point) { return point.gte(this.tl) && point.lte(this.br); }
}

class Slider {
  constructor(type = 'vert', long = 300, short = 50) {
    this.isVert = type === 'vert';
    this.long = long;
    this.short = short;
    this.shortExtra = short * 2;
    this.handleDim = 40;

    this.valueMin = 0.0;
    this.valueMax = 1.0;
    this.value = 0.5;
    this.shadowValue = 0.5;
    this.shadowActive = false;

    this.active = false;

    this.canvas = document.createElement('canvas');
    this.canvas.height = type === 'vert' ? this.long : this.shortExtra;
    this.canvas.width = type === 'vert' ? this.shortExtra : this.long;
    this.canvas.style.cursor = 'pointer';
    this.canvas.style.userSelect = 'none';
    this.ctx = this.canvas.getContext('2d');
    this.canvasHammer = new Hammer(this.canvas);

    this.canvasHammer.get('pan').set({ direction: Hammer.DIRECTION_ALL, threshold: 10 });

    this.canvasHammer.on('hammer.input', event => {
      this.render();
    });

    this.canvasHammer.on('doubletap', event => {
      this.value = this.calculatePosition(event);
    });

    Hammer.on(this.canvas, 'mousedown touchstart', event => {
      const point = this.getInputPoint(event);
      this.active = this.getHandleRect(this.value).contains(point);
      this.render();
    });
    Hammer.on(this.canvas, 'mouseup touchend', event => {
      this.active = false;
      if (this.shadowActive) {
        this.value = this.shadowValue;
        this.shadowActive = false;
      }

      this.render();
    });

    this.canvasHammer.on('panmove', event => {
      if (this.active) {
        this.value = this.calculatePosition(event);
      }
      else {
        const goodDirection = this.isVert ? Hammer.DIRECTION_VERTICAL : Hammer.DIRECTION_HORIZONTAL;
        const goodMovement = (event.direction & goodDirection) !== 0;
        const point = this.getInputPoint(event.srcEvent);
        const inShadowHandle = this.getHandleRect(this.shadowValue).contains(point);
        if (goodMovement) {
          this.shadowValue = this.calculatePosition(event);
        }
        else if (!inShadowHandle) {
          this.shadowActive = false;
        }
      }
      this.render();
    });

    this.canvasHammer.on('press', event => {
      const point = this.getInputPoint(event.srcEvent);
      const inHandle = this.getHandleRect(this.value).contains(point);
      if (!inHandle) {
        this.shadowValue = this.calculatePosition(event);
        this.shadowActive = true;
      }
      this.render();
    });
  }

  getInputPoint(event) {
    const bb = event.target.getBoundingClientRect();
    return new Point(event.pageX - bb.left, event.pageY - bb.top);
  }

  calculatePosition(event) {
    const bb = event.target.getBoundingClientRect();
    const longVal = this.isVert ? event.center.y - bb.top : event.center.x - bb.left;
    const v = Math.min(Math.max(0, longVal), this.long);
    return v / this.long;
  }

  getOrientationValue(twoOptions) {
    return twoOptions.slice()[this.isVert ? 'valueOf' : 'reverse']();
  }

  getHandleRect(value, dimension = this.handleDim) {
    const inRange = this.valueMax - this.valueMin;
    const outRange = this.valueMax - this.valueMin;
    const pos =  ((value - this.valueMin) / inRange) * (outRange + this.valueMin);
    const origDims = [this.short, dimension];
    const tl = this.getOrientationValue([this.short * 0.5 - (origDims[0] / 2),
                                         this.long * pos - (origDims[1] / 2)]);
    const dims = this.getOrientationValue(origDims);
    return new Rect(...tl, ...dims);
  }

  getExtendedRect(rect) {
    rect.br[this.getOrientationValue(['x', 'y'])[0]] *= 2;
    return rect;
  }

  render() {
    const can = this.canvas;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, can.width, can.height);

    ctx.save();

    {
      // border
      ctx.strokeStyle = 'rgb(43, 156, 212)';
      ctx.lineWidth = 1;
      ctx.strokeRect(1, 1, ...this.getOrientationValue([this.short - 2, this.long - 2]));
    }

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
    {
      const opacity = this.active ? 0.8 : 0.5;
      ctx.fillStyle = `rgba(43, 156, 212, ${opacity})`;

      const handleRect = this.getHandleRect(this.value, this.handleDim);
      const drawRect = (this.active ? this.getExtendedRect(handleRect) : handleRect).drawRect;
      ctx.fillRect(...drawRect);

      ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
      const middleRect = this.getHandleRect(this.value, 2);
      const middleDrawRect = (this.active ? this.getExtendedRect(middleRect) : middleRect).drawRect;
      ctx.fillRect(...middleDrawRect);

    }

    // shadow handle
    if (this.shadowActive) {
      ctx.strokeStyle = `rgba(43, 156, 212, 1.0)`;
      ctx.setLineDash([5, 5]);
      const handleRect = this.getHandleRect(this.shadowValue, this.handleDim);
      const direction = this.getOrientationValue(['x', 'y'])[0];
      handleRect.br[direction] *= 2;

      ctx.strokeRect(...handleRect.drawRect);
      ctx.strokeStyle = `rgb(0,0,0)`;
      const middleRect = this.getHandleRect(this.shadowValue, 1);
      middleRect.br[direction] *= 2;
      ctx.beginPath();
      ctx.moveTo(...middleRect.tl);
      ctx.lineTo(...middleRect.br);
      ctx.stroke();
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
