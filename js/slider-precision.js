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

    this._valueMin = 0.0;
    this._valueMax = 1.0;
    this.valueNorm = 0.5;

    this.active = false;
    this.isTouch = false;

    this.container = document.createElement('div');
    this.container.classList.add('slider-precision');
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
    this.canvas.height = type === 'vert' ? this.long : this.shortExtra;
    this.canvas.width = type === 'vert' ? this.shortExtra : this.long;
    this.canvas.style.cursor = 'pointer';
    this.canvas.style.userSelect = 'none';
    this.ctx = this.canvas.getContext('2d');
    this.canvasHammer = new Hammer(this.canvas);

    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    this.precisionMod = 0;
    this.modKeys = {
      Control: { mod: 1, down: false, time: Date.now(), unicode: '\u2303', button: undefined },
      Alt:     { mod: 2, down: false, time: Date.now(), unicode: '\u2325', button: undefined },
      Meta:    { mod: 3, down: false, time: Date.now(), unicode: '\u2318', button: undefined }
    };

    {
      const buttons = document.createElement('div');
      buttons.classList.add('buttons');
      this.container.appendChild(buttons);

      Object.keys(this.modKeys).forEach(key => {
        const button = document.createElement('input');
        this.modKeys[key].button = button;
        button.type = 'button';
        button.value = this.modKeys[key].unicode;
        buttons.appendChild(button);
      });
    }

    document.addEventListener('keydown', event => {
      event.preventDefault();
      if (!this.modKeys.hasOwnProperty(event.key)) { return; }

      const modKey = this.modKeys[event.key];
      modKey.down = true;
      modKey.time = Date.now();
      this.precisionMod = modKey.mod;
      modKey.button.classList.add('active');
    });

    document.addEventListener('keyup', event => {
      if (!this.modKeys.hasOwnProperty(event.key)) { return; }

      const modKey = this.modKeys[event.key];
      modKey.down = false;
      modKey.time = Date.now();
      modKey.button.classList.remove('active');

      const down = Object.keys(this.modKeys).filter(k => this.modKeys[k].down);
      const latestTime = Math.max(...down.map(k => this.modKeys[k].time));
      const latest = down.filter(k => this.modKeys[k].time === latestTime)[0];
      this.precisionMod = latest === undefined ? 0 : this.modKeys[latest].mod;
    });

    Hammer.on(this.canvas, 'mousedown touchstart', event => {
      const point = this.getInputPoint(event);
      this.active = this.getHandleRect(this.valueNorm).contains(point);
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
        this.valueNorm = this.calculateValueNorm(event);
        this.updateOutput();
      }
      this.render();
    });

    this.canvasHammer.on('press', event => {});
    this.canvasHammer.on('doubletap', event => {});
  }

  calculatePrecision() {
    const thing = Math.ceil(Math.log10(this._valueMax - this._valueMin));
    return 1 - thing;
  }

  round(number, precision = 0) {
    const factor = Math.pow(10, precision);
    const tempNumber = number * factor;
    const roundedTempNumber = Math.round(tempNumber);
    return roundedTempNumber / factor;
  }

  getInputPoint(event) {
    const bb = event.target.getBoundingClientRect();
    return new Point(event.clientX - bb.left, event.clientY - bb.top);
  }

  calculateValueNorm(event) {
    const bb = event.target.getBoundingClientRect();
    const x = event.hasOwnProperty('center') ? event.center.x : event.pageX;
    const y = event.hasOwnProperty('center') ? event.center.y : event.pageY;
    const longVal = this.getOrientationValue([this.long - (y - bb.top) , x - bb.left])[0];
    const v = Math.min(Math.max(0, longVal), this.long);
    return v / this.long;
  }

  getOrientationValue(twoOptions) {
    return twoOptions.slice()[this.isVert ? 'valueOf' : 'reverse']();
  }

  getHandleRect(valueNorm, dimension = this.handleDim) {
    const origDims = [this.short, dimension];
    const norm = this.getOrientationValue([1.0 - valueNorm, valueNorm])[0];
    const tl = this.getOrientationValue([this.short * 1.5 - (origDims[0] / 2),
                                         this.long * norm - (origDims[1] / 2)]);
    return new Rect(...tl, ...this.getOrientationValue(origDims));
  }

  get precision() {
    return 1 - Math.floor(Math.log10(this._valueMax - this._valueMin)) + this.precisionMod;
  }

  get value() {
    const outputRange = this._valueMax - this._valueMin;
    const scaled = (this._valueMin + (this.valueNorm * outputRange));
    return this.round(scaled, this.precision);
  }

  get valueRender() {
    return this.value.toFixed(Math.max(0, this.precision));
  }

  set valueMin(v) {
    this._valueMin = v;
    this.updateOutput();
  }

  set valueMax(v) {
    this._valueMax = v;
    this.updateOutput();
  }

  render() {
    const can = this.canvas;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, can.width, can.height);

    ctx.save();

    // line
    {
      ctx.fillStyle = '#000';
      const thickness = 2;
      const pos = this.short * 1.5 - (thickness / 2);
      const xy = this.getOrientationValue([pos, 0]);
      const dims = this.getOrientationValue([thickness, this.long]);
      ctx.fillRect(...xy, ...dims);
    }

    // handle
    {
      const opacity = this.active ? 0.8 : 0.5;
      ctx.fillStyle = `rgba(43, 156, 212, ${opacity})`;

      const handleRect = this.getHandleRect(this.valueNorm, this.handleDim);
      ctx.fillRect(...handleRect.drawRect);

      ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
      const middleRect = this.getHandleRect(this.valueNorm, 2);
      ctx.fillRect(...middleRect.drawRect);

    }

    ctx.restore();
  }

  updateOutput() {
    if (this.output !== undefined) { this.output.value = this.valueRender; }
  }

  appendTo(domNode) {
    domNode.appendChild(this.container);
    this.render();
  }

  setOutput(domNode) {
    this.output = domNode;
    this.updateOutput();
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
vert.valueMin = 0;
vert.valueMax = 10;
vert.appendTo(box);
createOutput(vert, box);

const horz = new SliderPrecision('horz');
horz.appendTo(box);
createOutput(horz, box);


// approaches
// 1. modifier keys
//    - mod key feedback
// 2. vertical slider
