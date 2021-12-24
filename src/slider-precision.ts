import "hammerjs";
import { Point } from "./Point";
import { Rect } from "./Rect";

// prevent mobile scrolling
document.ontouchmove = function (event) {
  event.preventDefault();
};

const constrain = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

type Orientation = "vert" | "horz";
type Shape = [number, number];
type RGB = [number, number, number];

class SliderLayer {
  public active: boolean;
  public alwaysVisible: boolean;
  public grabbed: boolean;
  public modValue: number;
  public canvas: HTMLCanvasElement;

  private orientation: Orientation;
  private _handleRatios: Shape;
  private rgb: RGB;
  private ctx: CanvasRenderingContext2D;
  private _value: number;
  private valueActions: Array<(value: number) => void>;
  private _otherValue: number;
  private shortLength!: number;
  private longLength!: number;

  constructor(
    canvas: HTMLCanvasElement,
    orientation: Orientation,
    modValue: number,
    handleRatios: Shape,
    rgb: RGB,
  ) {
    this.canvas = canvas;
    this.orientation = orientation;
    this.modValue = modValue;
    this._handleRatios = handleRatios;
    this.rgb = rgb;

    const ctx = this.canvas.getContext("2d");
    if (ctx === null) {
      throw new Error("Could not get canvas context");
    }
    this.ctx = ctx;
    this._value = 0.5;
    this.valueActions = [];
    this._otherValue = 0.5;
    this.active = false;
    this.grabbed = false;
    this.alwaysVisible = false;
    this.updateSize();

    Hammer.on(this.canvas, "mousedown touchstart", (event: HammerInput["srcEvent"]) => {
      const userPoint = this.getRelativePoint(event);
      this.grabbed = this.active && this.handleRect.contains(userPoint);
      this.render();
    });

    Hammer.on(document.body, "mouseup touchend", (_event: HammerInput["srcEvent"]) => {
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
      const axis = this.getOrientationValue(["y", "x"] as const);
      const userPos = userPoint[axis];
      const absValue = axis === "y" ? this.canvas.height - userPos : userPos;
      this.value = absValue / this.longLength;
    });
  }

  updateSize() {
    [this.shortLength, this.longLength] = this.getOrientationPair(["width", "height"] as const).map(
      (s: "width" | "height") => this.canvas[s],
    );
  }

  getRelativePoint(event: HammerInput["srcEvent"]) {
    const touchEvent = event as TouchEvent;
    const getFrom =
      event instanceof TouchEvent ? touchEvent.touches.item(touchEvent.touches.length - 1) : event;

    if (getFrom === null) {
      throw new Error("No touch for touch event");
    }

    const bb = this.canvas.getBoundingClientRect();
    const x = constrain(getFrom.clientX - bb.left, 0, this.canvas.width);
    const y = constrain(getFrom.clientY - bb.top, 0, this.canvas.height);

    return new Point(x, y);
  }

  addValueListener(func: (value: number) => void) {
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
    return this.getOrientationPair([
      this._handleRatios[0] * this.shortLength,
      this._handleRatios[1] * this.longLength,
    ]);
  }

  get isVert() {
    return this.orientation === "vert";
  }

  getOrientationPair<T>(pair: readonly T[]): [T, T] {
    return this.orientation === "vert" ? [pair[0], pair[1]] : [pair[1], pair[0]];
  }

  getOrientationValue<T>(pair: readonly T[]): T {
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

const LAYER_COLORS: RGB[] = [
  [43, 156, 212],
  [43, 212, 156],
  [249, 182, 118],
];

class SliderPrecision {
  public canvas: HTMLCanvasElement;

  private container: HTMLDivElement;
  private _min: number;
  private _max: number;
  private ctx: CanvasRenderingContext2D;
  private layers: SliderLayer[];
  private valueListeners: Array<(value: number) => void>;
  private layerListeners: Array<(index: number) => void>;

  constructor(width: number, height: number) {
    this.canvas = document.createElement("canvas");

    this.ctx = (() => {
      const ctx = this.canvas.getContext("2d");
      if (ctx === null) throw new Error("No Context for canvas");
      return ctx;
    })();
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.canvas.width = width;
    this.canvas.height = height;

    this.container = document.createElement("div");
    this.container.classList.add("slider");

    this._min = 0.0;
    this._max = 1.0;

    this.container.appendChild(this.canvas);

    this.layers = [
      { orientation: "vert" as Orientation, modValue: 0, value: 0.5, rgb: LAYER_COLORS[0] as RGB },
      { orientation: "horz" as Orientation, modValue: 1, value: 0.5, rgb: LAYER_COLORS[1] as RGB },
      { orientation: "horz" as Orientation, modValue: 2, value: 0.5, rgb: LAYER_COLORS[2] as RGB },
      // TODO allow adjusts on same orientation
    ].map((opts, i, arr) => {
      const isMain = i === 0;
      const scale = 0.2;
      const scales = [scale, isMain ? scale : scale * (1 - i * (1 / arr.length))];
      const handleRatios: Shape = [isMain ? height : width, width].map(
        (_v, i) => 1.0 * scales[i],
      ) as Shape;
      const layer = new SliderLayer(
        this.canvas,
        opts.orientation,
        opts.modValue,
        handleRatios,
        opts.rgb,
      );
      layer.addValueListener((_value) => {
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
    hammer.on("hammer.input", (_event) => this.render());

    document.body.addEventListener("keydown", (event) => {
      // event.preventDefault();
      // getting idx, can swap this out
      const num = parseInt(event.key, 10);
      if (!Number.isFinite(num)) {
        return;
      }
      const idx = num - 1;
      this.setActiveLayer(idx);
      // end getting idx
    });

    this.valueListeners = [];
    this.layerListeners = [];

    // this.shape = [width, height];
    this.render();
  }

  set shape(shape: Shape) {
    // const canvasDims = this.getOrientationPair(shape);
    this.canvas.width = shape[0];
    this.canvas.height = shape[1];

    for (const layer of this.layers) {
      layer.updateSize();
    }

    this.render();
  }

  getActiveLayerIndex() {
    const idx = this.layers.findIndex((layer) => layer.active);
    if (idx === -1) {
      throw new Error("bad index");
    }

    return idx;
  }

  setActiveLayer(idx: number) {
    if (idx < 0 || idx >= this.layers.length) {
      throw new RangeError("Bad Layer Index");
    }
    const activeLayer = this.layers.find((l) => l.active);
    if (activeLayer === undefined) {
      throw new RangeError("No active layer");
    }
    const grabbing = activeLayer.grabbed;
    this.layers.forEach((l) => (l.active = false));
    this.layers[idx].active = true;
    this.layers[idx].grabbed = grabbing;
    this.render();

    for (const listener of this.layerListeners) {
      listener(idx);
    }
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

  getReversedPairIf<T>(pair: readonly T[], test: boolean) {
    return test ? pair.slice().reverse() : pair.slice();
  }

  getReversedValueIf<T>(pair: readonly T[], test: boolean) {
    return test ? pair[1] : pair[0];
  }

  appendTo(element: HTMLElement) {
    element.appendChild(this.container);
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.layers.forEach((l) => l.render());
  }

  round(number: number, precision = 0) {
    const factor = Math.pow(10, precision);
    const tempNumber = number * factor;
    const roundedTempNumber = Math.round(tempNumber);
    return roundedTempNumber / factor;
  }

  getPrecision(mod: number) {
    return 1 - Math.floor(Math.log10(this.range)) + mod;
  }

  constrainToRange(value: number) {
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

  updateOutput() {
    this.valueListeners.forEach((vl) => vl(this.value));
  }

  addValueListener(func: (value: number) => void) {
    this.valueListeners.push(func);
  }

  addLayerListener(func: (value: number) => void) {
    this.layerListeners.push(func);
  }
}

function createOutput(input: SliderPrecision, parent = document.body) {
  const output = document.createElement("div");
  output.classList.add("output");
  parent.appendChild(output);

  const updateOutput = () => (output.textContent = `${input.value.toFixed(1)}º`);
  input.addValueListener(updateOutput);
  updateOutput();
}

const box = document.getElementById("left");
if (box === null) {
  throw new Error("could not find container");
}

let vert = new SliderPrecision(400, 800);
vert.min = 0;
vert.max = 360;

const updateShape = () => {
  const bounds = box.getBoundingClientRect();
  vert.shape = [bounds.width, bounds.height * 0.9];
};

window.addEventListener("resize", updateShape);
updateShape();

{
  const para = document.createElement("p");
  para.textContent = "Use number keys or buttons to set the active slider layer.";
  box.appendChild(para);

  // buttons

  const buttonParent = document.createElement("div");
  box.appendChild(buttonParent);
  buttonParent.style.display = "flex";
  buttonParent.style.justifyContent = "space-between";
  buttonParent.style.width = "100%";
  buttonParent.style.marginBottom = "1vh";
  [
    { key: 1, layer: 0, rgb: LAYER_COLORS[0] },
    { key: 2, layer: 1, rgb: LAYER_COLORS[1] },
    { key: 3, layer: 2, rgb: LAYER_COLORS[2] },
  ].forEach(({ key, layer, rgb }) => {
    const button = document.createElement("button");
    buttonParent.appendChild(button);
    button.textContent = `${key}`;
    button.onclick = () => vert.setActiveLayer(layer);

    const updateBg = (activeLayer: number) =>
      (button.style.backgroundColor = `rgba(${rgb.join(",")}, ${
        activeLayer === layer ? 1.0 : 0.4
      })`);

    updateBg(vert.getActiveLayerIndex());
    vert.addLayerListener((layerIndex) => updateBg(layerIndex));
  });
}

vert.appendTo(box);

{
  const outputParent = document.getElementById("right");
  if (outputParent === null) {
    throw new Error("Could not find outputparent");
  }

  const para = document.createElement("p");
  para.textContent = "Use the slider handles to align the blue square with the outline.";
  outputParent.appendChild(para);

  createOutput(vert, outputParent);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new Error("Could not create canvas context");
  }

  outputParent.appendChild(canvas);

  const resizeOutput = () => {
    const bounds = outputParent.getBoundingClientRect();
    const size = bounds.width;
    canvas.width = size;
    canvas.height = size;
    draw(ctx, vert.value);
  };

  window.addEventListener("resize", resizeOutput);
  resizeOutput();

  function draw(ctx: CanvasRenderingContext2D, angle: number) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const size = canvas.width * 0.5;
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

  vert.addValueListener((value) => {
    draw(ctx, value);
  });

  draw(ctx, vert.value);
}
