// prevent mobile scrolling
document.ontouchmove = function(event){ event.preventDefault(); };

function constrain(val, min, max) {
  return Math.max(min, Math.min(val, max));
}

class SliderLayer {
  constructor(canvas, orientation, modValue, rgb) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext('2d');
    this.orientation = orientation;
    this._value = 0.5;
    this.valueActions = [];
    this._otherValue = 0.5;
    this.modValue = modValue;
    this.rgb = rgb;
    this.active = false;
    this.grabbed = false;
    this.alwaysVisible = false;
    this._handleDims = [80, 40 / (modValue + 1)];
    [this.shortLength, this.longLength] = this.getOrientationPair(['width', 'height']).map(s => this.canvas[s]);

    Hammer.on(this.canvas, 'mousedown touchstart', event => {
      const userPoint = this.getRelativePoint(event);
      this.grabbed = this.active && this.handleRect.contains(userPoint);
    });

    Hammer.on(document.body, 'mouseup touchend', event => {
      this.grabbed = false;
    });

    const hammer = new Hammer(this.canvas);

    hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL, threshold: 10 });
    hammer.on('panmove', event => {
      if (!(this.active && this.grabbed)) { return; }
      const userPoint = this.getRelativePoint(event.srcEvent);
      const axis = this.getOrientationValue(['y', 'x']);
      const userPos = userPoint[axis];
      const absValue = axis === 'y' ? this.canvas.height - userPos : userPos;
      this.value = absValue / this.longLength;
    });
  }

  getRelativePoint(event) {
    const isTouch = event.type.includes('touch');
    const getFrom = isTouch ? event.touches.item(event.touches.length - 1) : event;
    const bb = this.canvas.getBoundingClientRect();
    const x = constrain(getFrom.clientX - bb.left, 0, this.canvas.width);
    const y = constrain(getFrom.clientY - bb.top, 0, this.canvas.height);
    return new Point(x, y);
  }

  addValueListener(func) {
    this.valueActions.push(func);
  }

  get value() { return this._value; }

  set value(value) {
    this._value = value;
    this.valueActions.forEach(func => func(this._value));
  }

  get otherValue() { return Math.abs(this.getOrientationValue([0, 1]) - this._otherValue);}

  set otherValue(otherValue) { this._otherValue = otherValue; }

  get handleDims() { return this.getOrientationPair(this._handleDims); }

  get isVert() { return this.orientation === 'vert'; }

  getOrientationPair(pair) {
    const clone = pair.slice();
    return this.orientation === 'vert' ? clone : clone.reverse();
  }

  getOrientationValue(pair) {
    return this.getOrientationPair(pair)[0];
  }

  get handleRect() {
    const dims = this.getOrientationPair(this.handleDims);
    // dims seem like they are the wrong way round, but they aren't
    // because the handle is perpendicular to the main direction
    const longValue = Math.abs(this.getOrientationValue([1, 0]) - this.value);
    const longPos = longValue * this.longLength - dims[1] / 2;
    // similar deal with the invert here...
    const shortPos = this.otherValue * this.shortLength - dims[0] / 2;
    const tl = new Point(...this.getOrientationPair([shortPos, longPos]));
    return new Rect(tl, tl.add(...this.handleDims));
  }

  render() {
    const opacity = this.active ? 1.0 : 0.0;
    this.ctx.save();

    // line
    this.ctx.fillStyle = `rgba(0, 0, 0, ${this.alwaysVisible || this.active ? 1.0 : 0})`;
    const thickness = 2;
    const halfThick = thickness / 2;
    const tl = new Point(...this.getOrientationPair([this.otherValue * this.shortLength - halfThick, 0]));
    const dims = this.getOrientationPair([thickness, this.longLength]);
    const lineRect = new Rect(tl, tl.add(...dims));
    this.ctx.fillRect(...lineRect.drawRect);

    // handle
    const handleOpacity = this.active
      ? this.grabbed
        ? 0.8
        : 0.5
      : this.alwaysVisible
        ? 0.8
        : 0.3;
    this.ctx.fillStyle = `rgba(${this.rgb.join(',')}, ${handleOpacity})`;
    this.ctx.fillRect(...this.handleRect.drawRect);
    this.ctx.restore();
  }
}

class SliderPrecision {
  constructor(orientation, longLength = 400, shortLength = 200) {
    this.orientation = orientation;

    this.container = document.createElement('div');
    this.container.classList.add('slider');

    this._min = 0.0;
    this._max = 1.0;

    this.canvas = document.createElement('canvas');
    {
      const canvasDims = this.getOrientationPair([shortLength, longLength]);
      this.canvas.width = canvasDims[0];
      this.canvas.height = canvasDims[1];
    }
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.layers = [];
    const orientations = this.getOrientationPair(['vert', 'horz']);
    this.layers = [
      { orientation: orientations[0], modValue: 0, value: 0.5, rgb: [43, 156, 212] },
      { orientation: orientations[1], modValue: 1, value: 0.5, rgb: [43, 212, 156] },
      { orientation: orientations[1], modValue: 2, value: 0.5, rgb: [249, 182, 118] },
    ].map((opts, i) => {

      const layer = new SliderLayer(this.canvas, opts.orientation, opts.modValue, opts.rgb);
      layer.addValueListener(value => { this.updateOutput(); });

      if (i === 0) {
        layer.active = true;
        layer.alwaysVisible = true;
        layer.addValueListener(value => this.layers.slice(1).forEach(l => l.otherValue = value));
      }
      return layer;
    });

    const hammer = new Hammer(this.canvas);
    hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL, threshold: 10 });
    hammer.on('hammer.input', event => this.render());

    document.addEventListener('keydown', event => {
      // getting idx, can swap this out
      const num = parseInt(event.key, 10);
      if (!Number.isFinite(num)) { return; }
      const idx = num - 1;
      // end getting idx

      if (idx >= this.layers.length) { return; }
      const grabbing = this.layers.find(l => l.active).grabbed;
      this.layers.forEach(l => l.active = false);
      this.layers[idx].active = true;
      this.layers[idx].grabbed = grabbing;
      this.render();
    });

    this.render();
  }

  get min() { return this._min; }
  set min(min) {
    this._min = min;
    this.render();
    this.updateOutput();
  }

  get max() { return this._max; }
  set max(max) {
    this._max = max;
    this.render();
    this.updateOutput();
  }

  get activeLayer() { return this.layers.find(l => l.active); }

  getOrientationPair(pair) {
    const clone = pair.slice();
    return this.orientation === 'vert' ? clone : clone.reverse();
  }

  getOrientationValue(pair) {
    return this.getOrientationPair(pair)[0];
  }

  appendTo(element) {
    element.appendChild(this.container);
  }

  set outputElement(element) {
    this.output = element;
    this.updateOutput();
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.layers.forEach(l => l.render());
  }

  round(number, precision = 0) {
    const factor = Math.pow(10, precision);
    const tempNumber = number * factor;
    const roundedTempNumber = Math.round(tempNumber);
    return roundedTempNumber / factor;
  }

  getPrecision(mod) {
    return 1 - Math.floor(Math.log10(this.max - this.min)) + mod;
  }

  constrainToRange(value) {
    return Math.max(this.min, Math.min(value, this.max));
  }

  get value() {
    const range = this.max - this.min;
    const mainValue = this.layers[0].value * range + this.min;
    const mainPrecision = this.getPrecision(this.layers[0].modValue);
    const mainRounded = this.constrainToRange(this.round(mainValue, mainPrecision));

    const adjustments = this.layers.slice(1).map((l, i) => {
      const precision = this.getPrecision(l.modValue);
      const subRange = Math.pow(10, -precision) * 10;
      const scaled = (l.value - 0.5) * 2 * subRange;
      const rounded = this.round(scaled, precision);
      return rounded;
    });
    const adjustment = adjustments.reduce((c, p) => c + p);

    return this.constrainToRange(mainRounded + adjustment);
  }

  get precisionRounding() {
    const modValues = this.layers.map(l => l.modValue);
    return this.getPrecision(Math.max(...modValues));
  }

  get valueRender() {
    return this.value.toFixed(Math.max(0, this.precisionRounding));
  }

  updateOutput() {
    if (this.output !== undefined) { this.output.value = this.valueRender; }
  }
}

function createOutput(input, parent = document.body) {
  const output = document.createElement('input');
  output.classList.add('output');
  parent.appendChild(output);
  input.outputElement = output;
}

const box = document.getElementById('container');

const vert = new SliderPrecision('vert');

vert.min = 50;
vert.max = 155;
vert.appendTo(box);
createOutput(vert, box);

const horz = new SliderPrecision('horz');
horz.appendTo(box);
createOutput(horz, box);


// approaches
// 2. vertical slider
