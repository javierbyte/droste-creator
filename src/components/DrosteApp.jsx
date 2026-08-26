'use client';

import { Text, Space, Dropzone, Inline, Tabs, Tab, Input, Button } from 'jbx';

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
import {
  computeTransforms,
  interpolateTransform,
  transformZoom,
  ZOOM_EASINGS,
  DEFAULT_ZOOM_EASING,
} from '@/lib/drosteMath.js';
import { createDrosteRenderer } from '@/lib/drosteRender.js';
import {
  exportDroste,
  exportSize,
  planExport,
  fpsFor,
  downloadBlob,
} from '@/lib/drosteExport.js';

const MAX_STAGE_VH = 0.6;

// Keep in sync with `.stage` in globals.css: the canvas clears to this, so it
// is also what shows through transparent source images in an export.
const STAGE_BACKGROUND = '#ecf0f1';

const SPEED_PRESETS = {
  Slow: 4,
  Normal: 2,
  Fast: 1,
};
const MIN_CYCLE_SECONDS = 0.2;
const MAX_CYCLE_SECONDS = 60;

const SIZE_PRESETS = {
  Small: 480,
  Medium: 720,
  Large: 1080,
};
const MIN_EXPORT_SIDE = 64;
const MAX_EXPORT_SIDE = 2048;

const MAX_EXPORT_SECONDS = 60;
const MAX_EXPORT_LOOPS = 20;

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

const DEFAULT_ANIMATIONS = {
  OFF: 'Off',
  IN: 'In',
  OUT: 'Out',
};

const EXPORT_FORMATS = {
  gif: 'GIF',
  mp4: 'Video',
};

const DRAW_MODES = {
  handleDragRectangle: 'Rectangle',
  handleDrag: 'Free',
  handleDragMirror: 'Mirror',
  handleDragLockAspect: 'Aspect Lock',
};

// Corners are laid out 0 top left, 1 top right, 2 bottom left, 3 bottom right.
// In rectangle mode a corner carries its neighbours with it: the one below or
// above it keeps its x, the one beside it keeps its y.
const SAME_COLUMN = [2, 3, 0, 1];
const SAME_ROW = [1, 0, 3, 2];

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

// Handles stay inside the picture: a corner outside it would sample nothing and
// leave a gap in the recursion.
function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function exampleToPoints(example) {
  return [
    { x: example[0], y: example[1] },
    { x: example[2], y: example[3] },
    { x: example[4], y: example[5] },
    { x: example[6], y: example[7] },
  ];
}

// Only shrinks what is too big for a texture -- exports default to the source
// image's own size, so throwing pixels away here would cap that default.
async function resizeImage(base64Str, maxSide = MAX_EXPORT_SIDE) {
  return new Promise((resolve) => {
    let img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let canvas = document.createElement('canvas');

      const originalWidth = img.width;
      const originalHeight = img.height;

      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));

      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));

      canvas.width = width;
      canvas.height = height;
      let ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve([canvas.toDataURL(), { originalWidth, originalHeight }]);
    };
  });
}

function DrosteApp() {
  const [sourceImage, sourceImageSet] = useState(EXAMPLES[DEFAULT_EXAMPLE_KEY]);
  const [currentExample, currentExampleSet] = useState(DEFAULT_EXAMPLE_KEY);

  const [drawMode, drawModeSet] = useState('handleDragRectangle');
  const [currentAnimation, currentAnimationSet] = useState(DEFAULT_ANIMATION);
  const [zoomEasing, zoomEasingSet] = useState(DEFAULT_ZOOM_EASING);

  const [cycleSeconds, cycleSecondsSet] = useState(SPEED_PRESETS.Normal);

  const [exportFormat, exportFormatSet] = useState('gif');
  // Null until the source image has loaded and reported its size.
  const [naturalSide, naturalSideSet] = useState(null);
  const [longestSide, longestSideSet] = useState(SIZE_PRESETS.Medium);

  const [minSeconds, minSecondsSet] = useState(3);
  const [minLoops, minLoopsSet] = useState(1);

  const [exportProgress, exportProgressSet] = useState(null);
  const [exportError, exportErrorSet] = useState(null);

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

  // The stage holds still while a handle is being placed -- aiming at a moving
  // target is the whole problem.
  const draggingRef = useRef(false);

  function handleDrag({ x, y }, id) {
    pointSet((oldPoints) => {
      const newPoints = [...oldPoints];
      newPoints[id] = { x: clamp01(x / width), y: clamp01(y / height) };
      return newPoints;
    });
  }

  function handleDragRectangle({ x, y }, id) {
    pointSet((oldPoints) => {
      const newPoints = [...oldPoints];
      const point = { x: clamp01(x / width), y: clamp01(y / height) };

      newPoints[id] = point;
      newPoints[SAME_COLUMN[id]] = {
        ...newPoints[SAME_COLUMN[id]],
        x: point.x,
      };
      newPoints[SAME_ROW[id]] = { ...newPoints[SAME_ROW[id]], y: point.y };

      return newPoints;
    });
  }

  function handleDragMirror({ x, y }, id) {
    pointSet((oldPoints) => {
      const newPoints = [...oldPoints];
      const point = { x: clamp01(x / width), y: clamp01(y / height) };

      newPoints[id] = point;
      newPoints[getCounterPoint(id)] = {
        x: 1 - point.x,
        y: 1 - point.y,
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

      const normalized = newPoints.map((point) => ({
        x: point.x / width,
        y: point.y / height,
      }));

      // Corners 1 and 2 are derived from the rotation, so they can swing out
      // even when the dragged one is inside. Refuse the whole move instead of
      // clamping, which would break the locked aspect.
      const escapes = normalized.some(
        (point) =>
          !(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)
      );

      return escapes ? oldPoints : normalized;
    });
  }

  const DRAW_MODE_FUNCTION = {
    handleDragRectangle,
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
  const imageTransformArray = computeTransforms({
    cssTransform,
    width,
    height,
  });

  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const imageRef = useRef(null);
  const [imageVersion, imageVersionSet] = useState(0);
  const [rendererError, rendererErrorSet] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // The canvas outlives the renderer across strict mode remounts, so the
      // context has to stay usable.
      rendererRef.current = createDrosteRenderer(canvas, {
        releaseContext: false,
      });

      // A fresh renderer starts without a texture, so re-upload whatever is
      // already loaded (fast refresh can rebuild it after the image landed).
      if (imageRef.current) rendererRef.current.setImage(imageRef.current);
    } catch (error) {
      rendererErrorSet(error.message);
      return;
    }

    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const image = new window.Image();

    image.onload = () => {
      if (cancelled) return;
      imageRef.current = image;

      // Exports default to the image's own size, and follow it when the source
      // changes -- the same way the corner handles reset to the new image.
      const longest = Math.max(image.naturalWidth, image.naturalHeight);
      const side = Math.min(
        MAX_EXPORT_SIDE,
        Math.max(MIN_EXPORT_SIDE, Math.round(longest))
      );

      naturalSideSet(side);
      longestSideSet(side);
      imageVersionSet((version) => version + 1);
    };
    image.src = sourceImage.src;

    return () => {
      cancelled = true;
    };
  }, [sourceImage.src]);

  useEffect(() => {
    if (!imageVersion || !rendererRef.current || !imageRef.current) return;
    rendererRef.current.setImage(imageRef.current);
  }, [imageVersion]);

  useEffect(() => {
    if (!rendererRef.current || !(width > 0)) return;
    rendererRef.current.resize(width, height, window.devicePixelRatio || 1);
  }, [width, height]);

  const animationRef = useRef(currentAnimation);
  useEffect(() => {
    animationRef.current = currentAnimation;
  }, [currentAnimation]);

  const cycleSecondsRef = useRef(cycleSeconds);
  useEffect(() => {
    cycleSecondsRef.current = cycleSeconds;
  }, [cycleSeconds]);

  // The animation loop reads the latest geometry from here, so that dragging a
  // handle never has to restart it.
  const drawStateRef = useRef(null);
  useEffect(() => {
    drawStateRef.current = {
      transforms: imageTransformArray,
      invertedTransform: invertedTransformArray,
      zoom:
        zoomEasing === 'LINEAR'
          ? transformZoom(invertedTransformArray, width, height)
          : null,
      width,
      height,
    };
  });

  const progressRef = useRef(0);
  useEffect(() => {
    let frame = null;
    let lastTime = null;

    function animate(now) {
      const elapsed =
        lastTime === null
          ? 0
          : Math.min((now - lastTime) / 1000, MAX_FRAME_SECONDS);
      lastTime = now;

      const step = draggingRef.current ? 0 : elapsed / cycleSecondsRef.current;

      if (animationRef.current === 'OUT') {
        progressRef.current += step;
        if (progressRef.current > 1) progressRef.current -= 1;
      } else if (animationRef.current === 'IN') {
        progressRef.current -= step;
        if (progressRef.current < 0) progressRef.current += 1;
      } else if (!draggingRef.current) {
        progressRef.current = 0;
      }

      const renderer = rendererRef.current;
      const drawState = drawStateRef.current;

      if (renderer && drawState && drawState.width > 0) {
        renderer.draw({
          transforms: drawState.transforms,
          animated: interpolateTransform(
            drawState.invertedTransform,
            progressRef.current,
            drawState.zoom
          ),
          width: drawState.width,
          height: drawState.height,
          background: STAGE_BACKGROUND,
        });
      }

      frame = window.requestAnimationFrame(animate);
    }

    frame = window.requestAnimationFrame(animate);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  const isAnimating = currentAnimation !== 'OFF';
  const activeFormat = isAnimating ? exportFormat : 'png';
  const exporting = exportProgress !== null;

  const exportDimensions = exportSize({
    longestSide,
    ratio: sourceImage.ratio,
  });
  const exportPlan = planExport({
    cycleSeconds,
    minSeconds,
    minLoops,
    fps: fpsFor(activeFormat),
  });

  async function onExport() {
    if (exporting || !imageRef.current) return;

    exportErrorSet(null);
    exportProgressSet(0);

    try {
      const { blob, extension } = await exportDroste({
        format: activeFormat,
        image: imageRef.current,
        points,
        ratio: sourceImage.ratio,
        longestSide,
        cycleSeconds,
        direction: currentAnimation,
        zoomEasing,
        minSeconds,
        minLoops,
        background: STAGE_BACKGROUND,
        onProgress: exportProgressSet,
      });

      downloadBlob(blob, `droste-${Date.now()}.${extension}`);
    } catch (error) {
      exportErrorSet(
        (error && error.message) || String(error) || 'The export failed.'
      );
    } finally {
      exportProgressSet(null);
    }
  }

  return (
    <Fragment>
      <div ref={stageWrapRef}>
        <div className="stage" style={{ height, width }}>
          <canvas
            ref={canvasRef}
            className="img"
            style={{ width, height }}
            aria-label="Droste effect preview"
          />

          {width > 0 &&
            [0, 1, 2, 3].map((pointIdx) => {
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
                  onStart={() => {
                    draggingRef.current = true;
                  }}
                  onDrag={(evt, data) =>
                    DRAW_MODE_FUNCTION[drawMode](data, pointIdx)
                  }
                  onStop={() => {
                    draggingRef.current = false;
                  }}
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
        </div>
      </div>

      {rendererError && (
        <Fragment>
          <Space h={1} />
          <Text>{rendererError}</Text>
        </Fragment>
      )}

      {currentExample !== null && (
        <div className="examples">
          {Object.keys(EXAMPLES).map((exampleKey) => (
            <button
              className={
                currentExample === exampleKey ? 'example -active' : 'example'
              }
              key={exampleKey}
              onClick={() => {
                currentExampleSet(exampleKey);
                sourceImageSet(EXAMPLES[exampleKey]);
              }}
            >
              {exampleKey}
            </button>
          ))}
        </div>
      )}

      <Space h={3} />

      <Dropzone onDrop={onFileSelected}>
        <Text>Click or drop your own image here</Text>
        <input
          type="file"
          onChange={onFileSelected}
          accept="image/*"
          aria-label="Drop an image here, or click to select"
        />
      </Dropzone>

      <Space h={1} />

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
        <Inline>
          <Tab info>
            <Text>Zoom:</Text>
          </Tab>
          {Object.keys(ZOOM_EASINGS).map((easingKey) => (
            <Tab
              active={zoomEasing === easingKey}
              key={easingKey}
              onClick={() => {
                zoomEasingSet(easingKey);
              }}
            >
              <Text>{ZOOM_EASINGS[easingKey]}</Text>
            </Tab>
          ))}
        </Inline>
      </Tabs>

      <Space h={1} />

      <Inline gap={0.5} style={{ alignItems: 'center' }}>
        <Tabs>
          <Inline>
            <Tab info>
              <Text>Speed:</Text>
            </Tab>
            {Object.keys(SPEED_PRESETS).map((speedKey) => (
              <Tab
                active={cycleSeconds === SPEED_PRESETS[speedKey]}
                key={speedKey}
                onClick={() => {
                  cycleSecondsSet(SPEED_PRESETS[speedKey]);
                }}
              >
                <Text>{speedKey}</Text>
              </Tab>
            ))}
          </Inline>
        </Tabs>
        <Input
          aria-label="Seconds per loop"
          value={cycleSeconds}
          onValueChange={cycleSecondsSet}
          step="0.5"
          min={MIN_CYCLE_SECONDS}
          max={MAX_CYCLE_SECONDS}
          style={{ flex: 'none', width: 88 }}
        />
        <Text>seconds per loop</Text>
      </Inline>

      <Space h={1} />

      <Inline gap={0.5} style={{ alignItems: 'center' }}>
        <Tabs>
          <Inline>
            <Tab info>
              <Text>Export size:</Text>
            </Tab>
            {naturalSide && (
              <Tab
                active={longestSide === naturalSide}
                onClick={() => {
                  longestSideSet(naturalSide);
                }}
              >
                <Text>Original</Text>
              </Tab>
            )}
            {Object.keys(SIZE_PRESETS).map((sizeKey) => (
              <Tab
                active={longestSide === SIZE_PRESETS[sizeKey]}
                key={sizeKey}
                onClick={() => {
                  longestSideSet(SIZE_PRESETS[sizeKey]);
                }}
              >
                <Text>{sizeKey}</Text>
              </Tab>
            ))}
          </Inline>
        </Tabs>
        <Input
          aria-label="Longest side in pixels"
          value={longestSide}
          onValueChange={longestSideSet}
          step="10"
          min={MIN_EXPORT_SIDE}
          max={MAX_EXPORT_SIDE}
          style={{ flex: 'none', width: 100 }}
        />
        <Text>
          px, giving {exportDimensions.width}&times;
          {exportDimensions.height}
        </Text>
      </Inline>

      {isAnimating && (
        <Fragment>
          <Space h={1} />

          <Inline gap={0.5} style={{ alignItems: 'center' }}>
            <Tabs>
              <Inline>
                <Tab info>
                  <Text>Export length:</Text>
                </Tab>
              </Inline>
            </Tabs>
            <Text>at least</Text>
            <Input
              aria-label="Minimum length in seconds"
              value={minSeconds}
              onValueChange={minSecondsSet}
              step="1"
              min={0}
              max={MAX_EXPORT_SECONDS}
              style={{ flex: 'none', width: 80 }}
            />
            <Text>seconds and</Text>
            <Input
              aria-label="Minimum number of loops"
              value={minLoops}
              onValueChange={minLoopsSet}
              step="1"
              min={1}
              max={MAX_EXPORT_LOOPS}
              style={{ flex: 'none', width: 72 }}
            />
            <Text>
              loops &rarr; {exportPlan.loops}&times;
              {exportPlan.cycleDuration.toFixed(2)}s ={' '}
              {exportPlan.duration.toFixed(2)}s, {exportPlan.totalFrames} frames
            </Text>
          </Inline>
        </Fragment>
      )}

      <Space h={1} />

      <Inline gap={0.5} style={{ alignItems: 'center' }}>
        <Tabs>
          <Inline>
            <Tab info>
              <Text>Export as:</Text>
            </Tab>
            {isAnimating ? (
              Object.keys(EXPORT_FORMATS).map((formatKey) => (
                <Tab
                  active={exportFormat === formatKey}
                  key={formatKey}
                  onClick={() => {
                    exportFormatSet(formatKey);
                  }}
                >
                  <Text>{EXPORT_FORMATS[formatKey]}</Text>
                </Tab>
              ))
            ) : (
              <Tab active>
                <Text>PNG</Text>
              </Tab>
            )}
          </Inline>
        </Tabs>
        <Button onClick={onExport} disabled={exporting || !!rendererError}>
          {exporting
            ? `Exporting… ${Math.round(exportProgress * 100)}%`
            : 'Download'}
        </Button>
      </Inline>

      {!isAnimating && (
        <Fragment>
          <Space h={1} />
          <Text>
            Pick the In or Out animation to export a looping gif or video.
          </Text>
        </Fragment>
      )}

      {exportError && (
        <Fragment>
          <Space h={1} />
          <Text>{exportError}</Text>
        </Fragment>
      )}
    </Fragment>
  );
}

export default DrosteApp;
