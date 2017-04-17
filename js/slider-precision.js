// prevent mobile scrolling
document.ontouchmove = function(event){ event.preventDefault(); };

function constrain(val, min, max) {
  return Math.max(min, Math.min(val, max));
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


    this.mousePos = new Point(0, 0);
    const hammer = new Hammer(this.canvas);

    Hammer.on(this.canvas, 'mousedown touchstart mousemove touchmove', event => {
      const isTouch = event.type.includes('touch');
      const getFrom = isTouch ? event.touches.item(event.touches.length - 1) : event;
      const bb = this.canvas.getBoundingClientRect();
      this.mousePos.x = constrain(getFrom.clientX - bb.left, 0, this.canvas.width);
      this.mousePos.y = constrain(getFrom.clientY - bb.top, 0, this.canvas.height);
    });


    this.render();
  }

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

  render() {
    this.ctx.save();

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.restore();
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
