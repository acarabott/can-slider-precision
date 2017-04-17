// prevent mobile scrolling
document.ontouchmove = function(event){ event.preventDefault(); };

function constrain(val, min, max) {
  return Math.max(min, Math.min(val, max));
}

class SliderLayer {
  constructor(canvas, orientation, modValue) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext('2d');
    this.orientation = orientation;
    this.value = 0.25;
    this.modValue = modValue;
    this._active = false;
    this.grabbed = false;
    this._handleDims = [80, 40];
    [this.shortLength, this.longLength] = this.getOrientationPair(['width', 'height']).map(s => this.canvas[s]);

    Hammer.on(this.canvas, 'mousedown touchstart', event => {
      const userPoint = this.getRelativePoint(event);
      this.grabbed = this.active && this.handleRect.contains(userPoint);
      this.render();
    });

    Hammer.on(document.body, 'mouseup touchend', event => {
      this.grabbed = false;
      this.render();
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
      this.render();
    });

    this.render();
  }

  getRelativePoint(event) {
    const isTouch = event.type.includes('touch');
    const getFrom = isTouch ? event.touches.item(event.touches.length - 1) : event;
    const bb = this.canvas.getBoundingClientRect();
    const x = constrain(getFrom.clientX - bb.left, 0, this.canvas.width);
    const y = constrain(getFrom.clientY - bb.top, 0, this.canvas.height);
    return new Point(x, y);
  }

  get handleDims() { return this.getOrientationPair(this._handleDims); }

  get isVert() { return this.orientation === 'vert'; }

  get active() { return this._active; }

  set active(active) {
    this._active = active;
    this.render();
  }

  getOrientationPair(pair) {
    const clone = pair.slice();
    return this.orientation === 'vert' ? clone : clone.reverse();
  }

  getOrientationValue(pair) {
    return this.getOrientationPair(pair)[0];
  }

  get handleRect() {
    const value = this.getOrientationValue([1 - this.value, this.value]);
    const dims = this.getOrientationPair(this.handleDims);
    // dims seem like they are the wrong way round, but they aren't
    const longPos = value * this.longLength - dims[1] / 2;
    const otherValue = 0.5;
    const shortPos = otherValue * this.shortLength - dims[0] / 2;
    const tl = new Point(...this.getOrientationPair([shortPos, longPos]));
    return new Rect(tl, tl.add(...this.handleDims));
  }

  render() {
    if (!this.active) { return; }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();

    // line
    this.ctx.fillStyle = '#000';
    const thickness = 2;
    const halfThick = thickness / 2;
    const tl = new Point(...this.getOrientationPair([this.shortLength / 2 - halfThick, 0]));
    const dims = this.getOrientationPair([thickness, this.longLength]);
    const lineRect = new Rect(tl, tl.add(...dims));
    this.ctx.fillRect(...lineRect.drawRect);

    // handle
    const opacity = this.grabbed ? 0.8 : 0.5;
    this.ctx.fillStyle = `rgba(43, 156, 212, ${opacity})`;
    this.ctx.fillRect(...this.handleRect.drawRect);
    this.ctx.restore();
  }
}

class SliderPrecision {
  constructor(orientation, longLength = 400, shortLength = 200) {
    this.orientation = orientation;

    this.container = document.createElement('div');
    this.container.classList.add('slider');

    this.canvas = document.createElement('canvas');
    {
      const canvasDims = this.getOrientationPair([shortLength, longLength]);
      this.canvas.width = canvasDims[0];
      this.canvas.height = canvasDims[1];
    }
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    {
      const orientations = this.getOrientationPair(['vert', 'horz']);
      this.layers = [
        { orientation: orientations[0], modValue: 0, value: 0.5 },
        { orientation: orientations[1], modValue: 1, value: 0.5 },
        { orientation: orientations[1], modValue: 2, value: 0.5 },
      ].map((opts, i) => {
        const layer = new SliderLayer(this.canvas, opts.orientation, opts.modValue);
        layer.active = i === 0;
        return layer;
      });
    }
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

vert.valueMin = 0;
vert.valueMax = 100;
vert.appendTo(box);
createOutput(vert, box);

const horz = new SliderPrecision('horz');
horz.appendTo(box);
createOutput(horz, box);


// approaches
// 2. vertical slider
