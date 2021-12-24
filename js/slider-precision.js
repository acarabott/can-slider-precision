/* global Hammer, Point, Rect */

// prevent mobile scrolling
document.ontouchmove = function (event) {
  event.preventDefault();
};

function constrain(val, min, max) {
  return Math.max(min, Math.min(val, max));
}

class SliderLayer {
  constructor(canvas, orientation, modValue, handleDims, rgb) {
    this.canvas = canvas;
    this.orientation = orientation;
    this.modValue = modValue;
    this._handleDims = handleDims;
    this.rgb = rgb;

    this.ctx = this.canvas.getContext("2d");
    this._value = 0.5;
    this.valueActions = [];
    this._otherValue = 0.5;
    this.active = false;
    this.grabbed = false;
    this.alwaysVisible = false;
    [this.shortLength, this.longLength] = this.getOrientationPair(["width", "height"]).map(
      (s) => this.canvas[s],
    );

    Hammer.on(this.canvas, "mousedown touchstart", (event) => {
      const userPoint = this.getRelativePoint(event);
      this.grabbed = this.active && this.handleRect.contains(userPoint);
      this.render();
    });

    Hammer.on(document.body, "mouseup touchend", (event) => {
      this.grabbed = false;
      this.render();
    });

    const hammer = new Hammer(this.canvas);

    hammer.get("pan").set({ direction: Hammer.DIRECTION_ALL, threshold: 10 });
    hammer.on("panmove", (event) => {
      if (!(this.active && this.grabbed)) {
        return;
      }
      const userPoint = this.getRelativePoint(event.srcEvent);
      const axis = this.getOrientationValue(["y", "x"]);
      const userPos = userPoint[axis];
      const absValue = axis === "y" ? this.canvas.height - userPos : userPos;
      this.value = absValue / this.longLength;
    });
  }

  getRelativePoint(event) {
    const isTouch = event.type.includes("touch");
    const getFrom = isTouch ? event.touches.item(event.touches.length - 1) : event;
    const bb = this.canvas.getBoundingClientRect();
    const x = constrain(getFrom.clientX - bb.left, 0, this.canvas.width);
    const y = constrain(getFrom.clientY - bb.top, 0, this.canvas.height);
    return new Point(x, y);
  }

  addValueListener(func) {
    this.valueActions.push(func);
  }

  get value() {
    return this._value;
  }

  set value(value) {
    this._value = value;
    this.valueActions.forEach((func) => func(this._value));
  }

  get otherValue() {
    return Math.abs(this.getOrientationValue([0, 1]) - this._otherValue);
  }

  set otherValue(otherValue) {
    this._otherValue = otherValue;
  }

  get handleDims() {
    return this.getOrientationPair(this._handleDims);
  }

  get isVert() {
    return this.orientation === "vert";
  }

  getOrientationPair(pair) {
    const clone = pair.slice();
    return this.orientation === "vert" ? clone : clone.reverse();
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
    const opacity = this.alwaysVisible || this.active ? 1.0 : 0.1;
    this.ctx.save();

    // line
    this.ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    const thickness = 1;
    const halfThick = 1;
    const tl = new Point(
      ...this.getOrientationPair([this.otherValue * this.shortLength - halfThick, 0]),
    );
    const dims = this.getOrientationPair([thickness, this.longLength]);
    const lineRect = new Rect(tl, tl.add(...dims));
    this.ctx.fillRect(...lineRect.drawRect);

    // handle
    const handleOpacity = this.active ? 0.95 : 0.3;
    this.ctx.fillStyle = `rgba(${this.rgb.join(",")}, ${handleOpacity})`;
    this.ctx.fillRect(...this.handleRect.drawRect);
    this.ctx.strokeStyle = `rgba(0, 0, 0, ${handleOpacity})`;
    this.ctx.strokeRect(...this.handleRect.drawRect);
    this.ctx.restore();
  }
}

class SliderPrecision {
  constructor(orientation, longLength = 800, shortLength = 400) {
    this.orientation = orientation;

    this.container = document.createElement("div");
    this.container.classList.add("slider");

    this._min = 0.0;
    this._max = 1.0;

    this.canvas = document.createElement("canvas");
    {
      const canvasDims = this.getOrientationPair([shortLength, longLength]);
      this.canvas.width = canvasDims[0];
      this.canvas.height = canvasDims[1];
    }
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    this.layers = [];
    const orientations = this.getOrientationPair(["vert", "horz"]);
    this.layers = [
      { orientation: orientations[0], modValue: 0, value: 0.5, rgb: [43, 156, 212] },
      { orientation: orientations[1], modValue: 1, value: 0.5, rgb: [43, 212, 156] },
      { orientation: orientations[1], modValue: 2, value: 0.5, rgb: [249, 182, 118] },
      // TODO allow adjusts on same orientation
    ].map((opts, i, arr) => {
      const isMain = i === 0;
      const scale = 0.2;
      const scales = [scale, isMain ? scale : scale * (1 - i * (1 / arr.length))];
      const handleDims = [isMain ? longLength : shortLength, shortLength].map(
        (v, i) => v * scales[i],
      );
      const layer = new SliderLayer(
        this.canvas,
        opts.orientation,
        opts.modValue,
        handleDims,
        opts.rgb,
      );
      layer.addValueListener((value) => {
        this.updateOutput();
      });

      if (isMain) {
        layer.active = true;
        layer.alwaysVisible = true;
        layer.addValueListener((value) =>
          this.layers.slice(1).forEach((l) => (l.otherValue = value)),
        );
      }
      return layer;
    });

    const hammer = new Hammer(this.canvas);
    hammer.get("pan").set({ direction: Hammer.DIRECTION_ALL, threshold: 10 });
    hammer.on("hammer.input", (event) => this.render());

    document.addEventListener("keydown", (event) => {
      // event.preventDefault();
      // getting idx, can swap this out
      const num = parseInt(event.key, 10);
      if (!Number.isFinite(num)) {
        return;
      }
      const idx = num - 1;
      // end getting idx

      if (idx < 0 || idx >= this.layers.length) {
        return;
      }
      const grabbing = this.layers.find((l) => l.active).grabbed;
      this.layers.forEach((l) => (l.active = false));
      this.layers[idx].active = true;
      this.layers[idx].grabbed = grabbing;
      this.render();
    });

    this.valueListeners = [];

    this.render();
  }

  get min() {
    return this._min;
  }
  set min(min) {
    this._min = min;
    this.render();
    this.updateOutput();
  }

  get max() {
    return this._max;
  }
  set max(max) {
    this._max = max;
    this.render();
    this.updateOutput();
  }

  get activeLayer() {
    return this.layers.find((l) => l.active);
  }

  getReversedPairIf(pair, test) {
    return test ? pair.slice().reverse() : pair.slice();
  }

  getReversedValueIf(pair, test) {
    return test ? pair[1] : pair[0];
  }

  getOrientationPair(pair) {
    return this.getReversedPairIf(pair, this.orientation === "horz");
  }

  getOrientationValue(pair) {
    return this.getReversedValueIf(pair, this.orientation === "horz");
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
    this.layers.forEach((l) => l.render());
  }

  round(number, precision = 0) {
    const factor = Math.pow(10, precision);
    const tempNumber = number * factor;
    const roundedTempNumber = Math.round(tempNumber);
    return roundedTempNumber / factor;
  }

  getPrecision(mod) {
    return 1 - Math.floor(Math.log10(this.range)) + mod;
  }

  constrainToRange(value) {
    return Math.max(this.min, Math.min(value, this.max));
  }

  get range() {
    return this.max - this.min;
  }

  get value() {
    const scaled = this.layers.map((layer, i) => {
      const isMain = i === 0;
      const precision = this.getPrecision(i);
      const range = isMain ? this.range : Math.pow(10, -precision) * 10 * 2;
      const scaled = layer.value * range + (isMain ? this.min : -(range / 2));
      const rounded = this.round(scaled, precision);
      return rounded;
    });
    return this.constrainToRange(scaled.reduce((c, p) => c + p));
  }

  get precisionRounding() {
    return this.getPrecision(Math.max(...this.layers.map((l) => l.modValue)));
  }

  get valueRender() {
    return this.value.toFixed(Math.max(0, this.precisionRounding));
  }

  updateOutput() {
    this.valueListeners.forEach((vl) => vl(this.value));
    if (this.output !== undefined) {
      this.output.value = this.valueRender;
    }
  }

  addValueListener(func) {
    this.valueListeners.push(func);
  }
}

function createOutput(input, parent = document.body) {
  const output = document.createElement("input");
  output.classList.add("output");
  output.style.width = input.canvas.width;
  parent.appendChild(output);
  input.outputElement = output;
}

const box = document.getElementById("container");

const vert = new SliderPrecision("vert");

vert.min = 0;
vert.max = 360;

createOutput(vert, box);
vert.appendTo(box);

// const horz = new SliderPrecision('horz');
// horz.appendTo(box);
// createOutput(horz, box);

{
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = 800;
  canvas.height = 800;
  document.body.appendChild(canvas);

  function draw(angle) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const size = 356;
    {
      // blue square
      ctx.save();
      ctx.fillStyle = "rgba(43, 156, 212, 1.0)";

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angle * Math.PI) / 180);
      const x = -(size / 2);
      const y = -(size / 2);
      ctx.fillRect(x, y, size, size);
      ctx.restore();
    }

    {
      // target
      const targetAngle = 123.5;
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((targetAngle * Math.PI) / 180);

      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
      const x = -(size / 2);
      const y = -(size / 2);
      ctx.strokeRect(x, y, size, size);
      ctx.restore();
    }
  }

  vert.addValueListener((value) => draw(value));

  draw(vert.value);
}
