'use client';

import { Text, Space, Dropzone, Inline, Tabs, Tab, Input } from 'jbx';

import {
  Fragment,
  createRef,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import Draggable from 'react-draggable';

import transform2d from '@/lib/4point.js';
import invertMatrix from '@/lib/invertMatrix.js';
import { BASE_PATH } from '@/lib/basePath.js';

const MAX_STAGE_VH = 0.6;

// Depth is automatic: copies are added until the newest one is about
// MIN_LAYER_PX across, with MAX_DEPTH as the hard ceiling.
const MIN_DEPTH = 2;
const MAX_DEPTH = 64;
const MIN_LAYER_PX = 8;

const SPEED_PRESETS = {
  Slow: 4,
  Normal: 2,
  Fast: 1,
};
const MIN_CYCLE_SECONDS = 0.2;
const MAX_CYCLE_SECONDS = 60;

const MAX_FRAME_SECONDS = 0.1;

function polar2cartesian({ distance, angle }) {
  return {
    x: distance * Math.cos(angle),
    y: distance * Math.sin(angle),
  };
}

function cartesian2polar({ x, y }) {
  return {
    distance: Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)),
    angle: Math.atan2(y, x),
  };
}

const nullTransformArray = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const DEFAULT_ANIMATIONS = {
  OFF: 'Off',
  IN: 'In',
  OUT: 'Out',
};

const DRAW_MODES = {
  handleDrag: 'Free',
  handleDragMirror: 'Mirror',
  handleDragLockAspect: 'Aspect Lock',
};

function getCounterPoint(id) {
  if (id === 0) return 3;
  if (id === 1) return 2;
  if (id === 2) return 1;
  if (id === 3) return 0;
}

function exampleSrc(name) {
  return `${BASE_PATH}/examples/${name}`;
}

const EXAMPLES = {
  'Tokyo 1': {
    src: exampleSrc('tokyo1.jpg'),
    ratio: 3 / 4,
    example: [0.15, 0.2, 0.85, 0.2, 0.15, 0.9, 0.85, 0.9],
  },
  'Tokyo 2': {
    src: exampleSrc('tokyo2.jpg'),
    ratio: 3 / 4,
    example: [0.15, 0.2, 0.85, 0.2, 0.15, 0.9, 0.85, 0.9],
  },
  'Tokyo 3': {
    src: exampleSrc('tokyo3.jpg'),
    ratio: 3 / 4,
    example: [0.15, 0.2, 0.85, 0.2, 0.15, 0.9, 0.85, 0.9],
  },
  Stars: {
    src: exampleSrc('stars.jpg'),
    ratio: 3 / 4,
    example: [0.15, 0.2, 0.85, 0.2, 0.15, 0.9, 0.85, 0.9],
  },
  Dotomblurry: {
    src: exampleSrc('dotomblurry.jpg'),
    ratio: 3 / 4,
    example: [0.15, 0.12, 0.85, 0.12, 0.15, 0.87, 0.85, 0.87],
  },
};

// Fixed so the prerendered html matches what the browser renders.
const DEFAULT_EXAMPLE_KEY = Object.keys(EXAMPLES)[0];
const DEFAULT_ANIMATION = 'IN';

function exampleToPoints(example) {
  return [
    { x: example[0], y: example[1] },
    { x: example[2], y: example[3] },
    { x: example[4], y: example[5] },
    { x: example[6], y: example[7] },
  ];
}

async function resizeImage(base64Str, maxMass = 728 * 728) {
  return new Promise((resolve) => {
    let img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let canvas = document.createElement('canvas');

      const originalWidth = img.width;
      const originalHeight = img.height;

      let width = img.width;
      let height = img.height;

      while (width * height > maxMass) {
        width = width / Math.sqrt(2, 2);
        height = height / Math.sqrt(2, 2);
      }

      width = Math.round(width);
      height = Math.round(height);

      canvas.width = width;
      canvas.height = height;
      let ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve([canvas.toDataURL(), { originalWidth, originalHeight }]);
    };
  });
}

function multmm(a, b) {
  // multiply two matrices
  var c = Array(9);
  for (var i = 0; i != 3; ++i) {
    for (var j = 0; j != 3; ++j) {
      var cij = 0;
      for (var k = 0; k != 3; ++k) {
        cij += a[3 * i + k] * b[3 * k + j];
      }
      c[3 * i + j] = cij;
    }
  }
  return c;
}

function sixteenToNine(sixteen) {
  const [
    var0,
    var3,
    null7,
    var6,
    var1,
    var4,
    null1,
    var7,
    null2,
    null3,
    null4,
    null5,
    var2,
    var5,
    null6,
    var8,
  ] = sixteen;

  return [var0, var1, var2, var3, var4, var5, var6, var7, var8];
}

function nineToSixteen(t) {
  return [
    t[0],
    t[3],
    0,
    t[6],
    t[1],
    t[4],
    0,
    t[7],
    0,
    0,
    1,
    0,
    t[2],
    t[5],
    0,
    t[8],
  ];
}

function multmm2(sixteenA, sixteenB) {
  const nineA = sixteenToNine(sixteenA);
  const nineB = sixteenToNine(sixteenB);

  return nineToSixteen(multmm(nineA, nineB));
}

function applyTransform(nine, x, y) {
  const w = nine[6] * x + nine[7] * y + nine[8];
  return {
    x: (nine[0] * x + nine[1] * y + nine[2]) / w,
    y: (nine[3] * x + nine[4] * y + nine[5]) / w,
  };
}

function layerLongestSide(sixteen, width, height) {
  const nine = sixteenToNine(sixteen);

  const corners = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ].map(([x, y]) => applyTransform(nine, x, y));

  let longest = 0;
  for (let idx = 0; idx < corners.length; idx++) {
    const from = corners[idx];
    const to = corners[(idx + 1) % corners.length];

    const side = Math.sqrt(
      Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)
    );

    if (!Number.isFinite(side)) return Infinity;
    if (side > longest) longest = side;
  }

  return longest;
}

function DrosteApp() {
  const [sourceImage, sourceImageSet] = useState(EXAMPLES[DEFAULT_EXAMPLE_KEY]);
  const [currentExample, currentExampleSet] = useState(DEFAULT_EXAMPLE_KEY);

  const [drawMode, drawModeSet] = useState('handleDrag');
  const [currentAnimation, currentAnimationSet] = useState(DEFAULT_ANIMATION);

  const [cycleSeconds, cycleSecondsSet] = useState(SPEED_PRESETS.Normal);
  const [speedDraft, speedDraftSet] = useState(String(SPEED_PRESETS.Normal));

  function speedSet(seconds) {
    cycleSecondsSet(seconds);
    speedDraftSet(String(seconds));
  }

  function speedDraftChange(value) {
    speedDraftSet(value);

    const parsed = Number(value);
    if (
      value.trim() !== '' &&
      Number.isFinite(parsed) &&
      parsed >= MIN_CYCLE_SECONDS &&
      parsed <= MAX_CYCLE_SECONDS
    ) {
      cycleSecondsSet(parsed);
    }
  }

  const [points, pointSet] = useState(() =>
    exampleToPoints(sourceImage.example)
  );

  const stageWrapRef = useRef(null);
  const [stage, stageSet] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const wrap = stageWrapRef.current;
    if (!wrap) return;

    function measure() {
      const available = wrap.getBoundingClientRect().width;
      const maxHeight = window.innerHeight * MAX_STAGE_VH;

      const width = Math.min(available, maxHeight * sourceImage.ratio);
      stageSet({ width, height: width / sourceImage.ratio });
    }

    measure();

    const observer = new window.ResizeObserver(measure);
    observer.observe(wrap);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sourceImage.ratio]);

  const { width, height } = stage;

  useEffect(() => {
    pointSet(exampleToPoints(sourceImage.example));
  }, [sourceImage]);

  const pointRefs = useRef([0, 1, 2, 3].map(() => createRef()));

  function handleDrag({ x, y }, id) {
    pointSet((oldPoints) => {
      const newPoints = [...oldPoints];
      newPoints[id] = { x: x / width, y: y / height };
      return newPoints;
    });
  }

  function handleDragMirror({ x, y }, id) {
    pointSet((oldPoints) => {
      const newPoints = [...oldPoints];
      newPoints[id] = { x: x / width, y: y / height };
      newPoints[getCounterPoint(id)] = {
        x: 1 - x / width,
        y: 1 - y / height,
      };
      return newPoints;
    });
  }

  function handleDragLockAspect({ x, y }, id) {
    pointSet((oldPoints) => {
      const newPoints = oldPoints.map((point) => ({
        x: point.x * width,
        y: point.y * height,
      }));

      // moved point
      newPoints[id] = { x, y };

      const origin = newPoints[0];

      const axisPointPolar = cartesian2polar({
        x: newPoints[3].x - origin.x,
        y: newPoints[3].y - origin.y,
      });

      const originalPoint1Polar = cartesian2polar({
        x: width,
        y: 0,
      });

      const originalPoint2Polar = cartesian2polar({
        x: 0,
        y: height,
      });

      const originalPoint3Polar = cartesian2polar({
        x: width,
        y: height,
      });

      const originalAxisDistance = Math.sqrt(width * width + height * height);

      const axisDistance = Math.sqrt(
        Math.pow(newPoints[3].x - origin.x, 2) +
          Math.pow(newPoints[3].y - origin.y, 2)
      );

      const point1PolarTransformed = {
        distance: (axisDistance / originalAxisDistance) * width,
        angle:
          axisPointPolar.angle +
          originalPoint1Polar.angle -
          originalPoint3Polar.angle,
      };

      newPoints[1] = {
        x: origin.x + polar2cartesian(point1PolarTransformed).x,
        y: origin.y + polar2cartesian(point1PolarTransformed).y,
      };

      const point2PolarTransformed = {
        distance: (axisDistance / originalAxisDistance) * height,
        angle:
          axisPointPolar.angle +
          originalPoint2Polar.angle -
          originalPoint3Polar.angle,
      };

      newPoints[2] = {
        x: origin.x + polar2cartesian(point2PolarTransformed).x,
        y: origin.y + polar2cartesian(point2PolarTransformed).y,
      };

      return newPoints.map((point) => ({
        x: point.x / width,
        y: point.y / height,
      }));
    });
  }

  const DRAW_MODE_FUNCTION = {
    handleDrag,
    handleDragMirror,
    handleDragLockAspect,
  };

  const onFileSelected = useCallback((event) => {
    event.stopPropagation();
    event.preventDefault();

    const dt = event.dataTransfer;
    const files = dt ? dt.files : event.target.files;
    const file = files && files[0];
    if (!file) return;

    const fr = new window.FileReader();

    fr.onload = async (data) => {
      const base64src = data.currentTarget.result;

      const [base64, imageData] = await resizeImage(base64src);

      currentExampleSet(null);
      sourceImageSet({
        src: base64,
        ratio: imageData.originalWidth / imageData.originalHeight,
        example: [0.2, 0.2, 0.8, 0.2, 0.2, 0.8, 0.8, 0.8],
      });
    };
    fr.readAsDataURL(file);
  }, []);

  const pixelPoints = points.map((point) => ({
    x: point.x * width,
    y: point.y * height,
  }));

  const cssTransform = transform2d(
    width,
    height,
    pixelPoints[0].x,
    pixelPoints[0].y,
    pixelPoints[1].x,
    pixelPoints[1].y,
    pixelPoints[2].x,
    pixelPoints[2].y,
    pixelPoints[3].x,
    pixelPoints[3].y
  );
  const invertedTransformArray = invertMatrix(cssTransform).flat();

  const imageTransformArray = [nullTransformArray];

  while (width > 0 && height > 0 && imageTransformArray.length < MAX_DEPTH) {
    const previous = imageTransformArray[imageTransformArray.length - 1];
    const transform = multmm2(previous, cssTransform.flat());

    imageTransformArray.push(transform);

    if (
      imageTransformArray.length >= MIN_DEPTH &&
      layerLongestSide(transform, width, height) <= MIN_LAYER_PX
    ) {
      break;
    }
  }

  const animatableRef = useRef(null);
  const animationRef = useRef(currentAnimation);
  useEffect(() => {
    animationRef.current = currentAnimation;
  }, [currentAnimation]);

  const cycleSecondsRef = useRef(cycleSeconds);
  useEffect(() => {
    cycleSecondsRef.current = cycleSeconds;
  }, [cycleSeconds]);

  const progressRef = useRef(0);
  useEffect(() => {
    let frame = null;
    let lastTime = null;

    function animate(now) {
      const animatableEl = animatableRef.current;
      if (!animatableEl) return;

      const elapsed =
        lastTime === null
          ? 0
          : Math.min((now - lastTime) / 1000, MAX_FRAME_SECONDS);
      lastTime = now;

      const step = elapsed / cycleSecondsRef.current;

      if (animationRef.current === 'OUT') {
        progressRef.current += step;
        if (progressRef.current > 1) progressRef.current -= 1;
      } else if (animationRef.current === 'IN') {
        progressRef.current -= step;
        if (progressRef.current < 0) progressRef.current += 1;
      } else {
        progressRef.current = 0;
      }

      const progress = progressRef.current;

      const interpolatedValues = invertedTransformArray.map((el, elIdx) => {
        return el * progress + nullTransformArray[elIdx] * (1 - progress);
      });

      animatableEl.style.transform = `matrix3d(${interpolatedValues.join(
        ','
      )})`;

      frame = window.requestAnimationFrame(animate);
    }

    frame = window.requestAnimationFrame(animate);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [invertedTransformArray]);

  return (
    <Fragment>
      <div ref={stageWrapRef}>
        <div className="stage" style={{ height, width }}>
          {width > 0 && (
            <Fragment>
              <div
                className="img image-container-cut"
                style={{
                  height,
                  width,
                  overflow: 'hidden',
                }}
              >
                <div
                  ref={animatableRef}
                  className="main-animatable image-container -transformable"
                >
                  {imageTransformArray.map((transform, imageIdx) => (
                    <img
                      key={imageIdx}
                      alt=""
                      className="img -transformed -transformable"
                      style={{
                        width,
                        height,
                        transform: `matrix3d(${transform.join(',')})`,
                      }}
                      src={sourceImage.src}
                    />
                  ))}
                </div>
              </div>

              {[0, 1, 2, 3].map((pointIdx) => {
                if (
                  drawMode === 'handleDragLockAspect' &&
                  (pointIdx === 1 || pointIdx === 2)
                ) {
                  return null;
                }

                return (
                  <Draggable
                    key={pointIdx}
                    nodeRef={pointRefs.current[pointIdx]}
                    position={pixelPoints[pointIdx]}
                    onDrag={(evt, data) =>
                      DRAW_MODE_FUNCTION[drawMode](data, pointIdx)
                    }
                  >
                    <button
                      ref={pointRefs.current[pointIdx]}
                      className="point"
                      aria-label={`Corner ${pointIdx}`}
                    >
                      {pointIdx}
                    </button>
                  </Draggable>
                );
              })}
            </Fragment>
          )}
        </div>
      </div>

      <Space h={2} />

      <Tabs>
        <Inline>
          <Tab info>
            <Text>Controls:</Text>
          </Tab>
          {Object.keys(DRAW_MODES).map((drawModeKey) => (
            <Tab
              active={drawMode === drawModeKey}
              key={drawModeKey}
              onClick={() => {
                drawModeSet(drawModeKey);
              }}
            >
              <Text>{DRAW_MODES[drawModeKey]}</Text>
            </Tab>
          ))}
        </Inline>
      </Tabs>

      <Space h={1} />

      <Tabs>
        <Inline>
          <Tab info>
            <Text>Animation:</Text>
          </Tab>
          {Object.keys(DEFAULT_ANIMATIONS).map((animationKey) => (
            <Tab
              active={currentAnimation === animationKey}
              key={animationKey}
              onClick={() => {
                currentAnimationSet(animationKey);
              }}
            >
              <Text>{DEFAULT_ANIMATIONS[animationKey]}</Text>
            </Tab>
          ))}
        </Inline>
      </Tabs>

      <Space h={1} />

      <Tabs>
        <Inline style={{ alignItems: 'center' }}>
          <Tab info>
            <Text>Speed:</Text>
          </Tab>
          {Object.keys(SPEED_PRESETS).map((speedKey) => (
            <Tab
              active={cycleSeconds === SPEED_PRESETS[speedKey]}
              key={speedKey}
              onClick={() => {
                speedSet(SPEED_PRESETS[speedKey]);
              }}
            >
              <Text>{speedKey}</Text>
            </Tab>
          ))}
          <Tab info>
            <Inline wrap={false} style={{ alignItems: 'center' }}>
              <Space w={0.5} inline />
              <Input
                type="number"
                aria-label="Seconds per loop"
                value={speedDraft}
                onChange={(e) => speedDraftChange(e.target.value)}
                step="0.5"
                min={MIN_CYCLE_SECONDS}
                max={MAX_CYCLE_SECONDS}
                style={{ flex: 'none', width: 72 }}
              />
              <Space w={0.5} inline />
              <Text>seconds per loop</Text>
            </Inline>
          </Tab>
        </Inline>
      </Tabs>

      <Space h={1} />

      <Tabs>
        <Inline>
          <Tab info>
            <Text>Examples:</Text>
          </Tab>
          {Object.keys(EXAMPLES).map((exampleKey) => (
            <Tab
              active={currentExample === exampleKey}
              key={exampleKey}
              onClick={() => {
                currentExampleSet(exampleKey);
                sourceImageSet(EXAMPLES[exampleKey]);
              }}
            >
              <Text>{exampleKey}</Text>
            </Tab>
          ))}
        </Inline>
      </Tabs>

      <Space h={2} />

      <Dropzone onDrop={onFileSelected}>
        <Text>Click or drop your own image here</Text>
        <input
          type="file"
          onChange={onFileSelected}
          accept="image/*"
          aria-label="Drop an image here, or click to select"
        />
      </Dropzone>
    </Fragment>
  );
}

export default DrosteApp;
