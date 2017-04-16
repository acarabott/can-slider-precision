// prevent mobile scrolling
document.ontouchmove = function(event){ event.preventDefault(); };

function constrain(val, min, max) {
  return Math.max(min, Math.min(val, max));
}

class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  gte(point) { return this.x >= point.x && this.y >= point.y; }
  lte(point) { return this.x <= point.x && this.y <= point.y; }

  *[Symbol.iterator]() { yield this.x; yield this.y; }

  toString() { return `${this.x}, ${this.y}`; }

  subtract(pointOrX, y) {
    const args = pointOrX instanceof Point
      ? [this.x - pointOrX.x, this.y - pointOrX.y]
      : [this.x - pointOrX, this.y - y];
    return new Point(...args);
  }

  add(pointOrX, y) {
    const args = pointOrX instanceof Point
      ? [this.x + pointOrX.x, this.y + pointOrX.y]
      : [this.x + pointOrX, this.y + y];
    return new Point(...args);
  }
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

  toString() {
    return `${this.tl}, ${this.br}`;
  }
}

class ModKey {
  constructor(key, modValue, unicode, step, width, height) {
    this.key = key;
    this.modValue = modValue;
    this.unicode = unicode;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.down = false;
    this.active = false;
    this._step = step;
    this.isTouch = window.ontouchstart !== undefined;

    const changeActionFactory = down => {
      return event => {
        this.down = down;
        this.down ? this.activate() : this.deactivate();
      };
    };

    const keyActionFactory = down => {
      const changeAction = changeActionFactory(down);
      return event => {
        if (event.key !== this.key) { return; }
        changeAction(event);
      };
    };

    document.addEventListener('keydown', keyActionFactory(true));

    this.canvasHammer = new Hammer(this.canvas);
    this.canvasHammer.on('hammer.input', event => {
      this.render();
    });

    Hammer.on(this.canvas, 'mousedown touchstart', changeActionFactory(true));

    this.render();
  }

  activate() {
    this.active = true;
    this.render();
  }

  deactivate() {
    this.active = false;
    this.render();
  }

  toggleActive() { this.active ? this.deactivate() : this.activate(); }

  get text() {
    return `${this.isTouch ? '' : `${this.unicode} `}${this._step}`;
  }

  set step(step) {
    this._step = step;
    this.render();
  }

  render() {
    this.ctx.save();
    const fullRect = [0, 0, this.canvas.width, this.canvas.height];

    this.ctx.clearRect(...fullRect);
    this.ctx.fillStyle = this.active ? 'rgb(43, 156, 212)' : '#fff';
    this.ctx.fillRect(...fullRect);

    this.ctx.fillStyle = this.active ? '#fff' : '#000';
    const x = (this.canvas.width - this.ctx.measureText(this.text).width) / 2;
    const y = (this.canvas.height) / 2;
    this.ctx.textBaseline = 'middle';
    this.ctx.font = '11px Lato';
    this.ctx.fillText(this.text, x, y);

    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = '#000';
    this.ctx.strokeRect(...fullRect);

    this.ctx.restore();
  }
}

class SliderPrecision {
  static getStepString(precision) {
    const zeroCount = Math.abs(precision);
    return zeroCount === 0 ? '1' : precision < 0
      ? `1${'0'.repeat(zeroCount)}`
      : `0.${'0'.repeat(zeroCount - 1)}1`;
  }

  constructor(type = 'vert', long = 300, short = 50) {
    this.isVert = type === 'vert';
    this.longLength = long;
    this.shortLength = short * 4;
    this.adjustLength = short * 3;
    this.handleDims = this.getOrientationValue([short, 40]);

    this._valueMin = 0.0;
    this._valueMax = 1.0;
    this.valuePoint = new Point(0.5, 0.5);

    this.active = false;
    this.isTouch = window.ontouchstart !== undefined;

    this.container = document.createElement('div');
    this.container.classList.add('slider-precision');
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
    this.canvas.height = type === 'vert' ? this.longLength : this.shortLength;
    this.canvas.width = type === 'vert' ? this.shortLength : this.longLength;
    this.canvas.style.cursor = 'pointer';
    this.canvas.style.userSelect = 'none';
    this.ctx = this.canvas.getContext('2d');
    this.canvasHammer = new Hammer(this.canvas);

    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    this.modButtons = [];

    this.buttonContainer = document.createElement('div');
    this.buttonContainer.classList.add('buttons');
    this.container.appendChild(this.buttonContainer);

    [
      // { key: 'default', mod: 0, unicode: '' },
      { key: 'Control', mod: 0, unicode: '\u2303' },
      { key:     'Alt', mod: 1, unicode: '\u2325' },
      { key:    'Meta', mod: 2, unicode: '\u2318' }
    ].forEach((o, i) => {
      const step = this.getButtonStep(o.mod);
      const mk = new ModKey(o.key, o.mod, o.unicode, step, 50, 50);
      if (i === 0) { mk.activate(); }
      this.modButtons.push(mk);
      this.buttonContainer.appendChild(mk.canvas);
    });

    document.addEventListener('keydown', event => {
      if (!this.modButtons.some(mb => mb.key === event.key)) { return; }
      this.modButtons.forEach(mb => { if (mb.key !== event.key) { mb.deactivate(); } });
      this.render();
    });


    Hammer.on(this.canvas, 'mousedown touchstart', event => {
      if (event.target !== this.canvas) { return; }

      const isTouch = event.type === 'touchstart';
      const getFrom = isTouch ? event.touches[event.touches.length - 1] : event;
      const point = this.getInputPointFromEvent(getFrom);
      // const handleRect = this.getHandleRect(this.valuePoint, ...this.handleDims);
      // this.active = handleRect.contains(point);
      this.active = true;
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
        const valuePoint = this.getValuePointFromEvent(event.srcEvent);
        const toChangePair = this.getReversedPairIf(this.adjusting, ['x', 'y']);
        const toChange = this.getOrientationValue(toChangePair)[0];
        this.valuePoint[toChange] = valuePoint[toChange];
        this.updateOutput();
      }
      this.render();
    });

    this.canvasHammer.on('press', event => {});
    this.canvasHammer.on('doubletap', event => {});

  }

  getButtonStep(modValue) {
    return SliderPrecision.getStepString(this.getPrecision() + modValue);
  }

  updateButtonStep(modKey) {
    modKey.step = this.getButtonStep(modKey.modValue);
  }

  updateAllButtonsText() {
    this.modButtons.forEach(mb => this.updateButtonStep(mb));
  }

  round(number, precision = 0) {
    const factor = Math.pow(10, precision);
    const tempNumber = number * factor;
    const roundedTempNumber = Math.round(tempNumber);
    return roundedTempNumber / factor;
  }

  getInputPointFromEvent(event) {
    const bb = this.canvas.getBoundingClientRect();
    return new Point(event.clientX - bb.left, event.clientY - bb.top);
  }

  getValuePointFromEvent(event) {
    const inputPoint = this.getInputPointFromEvent(event);
    const dimensions = this.getOrientationValue([this.shortLength, this.longLength]);
    const coords = [...inputPoint].map((c, i) => constrain(c, 0, dimensions[i]) / dimensions[i]);
    return new Point(coords[0], 1.0 - coords[1]);
  }

  getHandleRect(valuePoint, width, height) {
    const lengths = this.getOrientationValue([this.shortLength, this.longLength]);
    const xm = this.getOrientationValue([this.adjusting ? valuePoint.x : 0.5, valuePoint.x])[0];
    const ym = this.getOrientationValue([valuePoint.y, this.adjusting ? valuePoint.y : 0.5])[0];
    const x = xm * lengths[0] - this.getOrientationValue([width / 2, 0])[0];
    const y = (1.0 - ym) * lengths[1] - this.getOrientationValue([0, height / 2])[0];
    return new Rect(x, y, width, height);
  }

  getReversedPairIf(test, pair) {
    return pair.slice()[test ? 'valueOf' : 'reverse']();
  }

  getOrientationValue(twoOptions) {
    return this.getReversedPairIf(this.isVert, twoOptions);
  }

  getPrecision(mod = 0) {
    return 1 - Math.floor(Math.log10(this._valueMax - this._valueMin)) + mod;
  }

  get activeButton() {
    return this.modButtons.find(mb => mb.active);
  }

  get adjusting() {
    return this.activeButton.modValue !== 0;
  }

  get precisionRounding() {
    return this.getPrecision(this.activeButton.modValue);
  }

  get value() {
    const outputRange = this._valueMax - this._valueMin;
    const scaled = (this._valueMin + (this.valueNorm * outputRange));
    // TODO take into account the adjustment
    return this.round(scaled, this.precisionRounding);
  }

  get valueRender() {
    return this.value.toFixed(Math.max(0, this.precisionRounding));
  }

  set valueMin(v) {
    this._valueMin = v;
    this.updateOutput();
    this.updateAllButtonsText();
  }

  set valueMax(v) {
    this._valueMax = v;
    this.updateOutput();
    this.updateAllButtonsText();
  }

  render() {
    const can = this.canvas;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, can.width, can.height);

    ctx.save();

    { // line
      ctx.fillStyle = '#000';
      const thickness = 2;
      const pos = this.shortLength * 0.5 - (thickness / 2);
      const xy = this.getOrientationValue([pos, 0]);
      const dims = this.getOrientationValue([thickness, this.longLength]);
      ctx.fillRect(...xy, ...dims);
    }


    // horz slider line
    // if (this.activeButton.modValue !== 0) {
    //   ctx.fillStyle = '#000';
    //   const thickness = 2;
    //   const lineRect = this.getHandleRect(this.valueNorm, 2, this.adjustLength);
    //   ctx.fillRect(...lineRect.drawRect);
    // }

    { // handle
      const opacity = this.active ? 0.8 : 0.5;
      ctx.fillStyle = `rgba(43, 156, 212, ${opacity})`;

      const handleRect = this.getHandleRect(this.valuePoint, ...this.handleDims);
      ctx.fillRect(...handleRect.drawRect);

      // ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
      // const middleRect = this.getHandleRect(this.valueNorm, 2, this.short);
      // ctx.fillRect(...middleRect.drawRect);
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
vert.valueMax = 100;
vert.appendTo(box);
createOutput(vert, box);

const horz = new SliderPrecision('horz');
horz.appendTo(box);
createOutput(horz, box);


// approaches
// 2. vertical slider
