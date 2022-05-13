import { Button, Text, Space, A } from 'jbx';

import { Fragment, useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';

import transform2d from './lib/4point.js';
import invertMatrix from './lib/invertMatrix.js';

const rnd = window.fxrand || Math.random;
function rndArr(arr) {
  return arr.map((e) => {
    let tmp = e + (rnd() * 0.2 - 0.1);
    if (tmp < 0.5) {
      return tmp / 2;
    } else {
      return (tmp + 1) / 2;
    }
  });
}

const SHOW_UI = true;
const TOPNAV_HEIGHT = SHOW_UI ? 64 : 0;
const SIDEBAR_WIDTH = 300;

window.GLOBAL_ANIMATION = rnd() > 0.5 ? 'IN' : 'OUT';

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

const useClickOutside = (ref, callback) => {
  const handleClick = (e) => {
    if (ref.current && !ref.current.contains(e.target)) {
      callback();
    }
  };
  useEffect(() => {
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  });
};

function Dropdown({ label, value, options, onChange, disabled = false }) {
  const [isVisible, isVisibleSet] = useState(false);
  const clickRef = useRef();
  useClickOutside(clickRef, () => {
    isVisibleSet(false);
  });

  return (
    <div
      className={`dropdown ${isVisible ? '' : '-hide'} ${
        disabled ? '-disabled' : ''
      }`}
      ref={clickRef}
      onClick={() => {
        isVisibleSet(!disabled && !isVisible);
      }}
    >
      <Text className="dropdown-header">
        {label} <strong>{options[value]}</strong>
      </Text>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>

      <div className="dropdown-options">
        {Object.keys(options).map((optionKey) => (
          <div
            className="dropdown-option"
            key={optionKey}
            onClick={() => {
              onChange(optionKey);
              isVisibleSet(false);
            }}
          >
            <Text>{options[optionKey]}</Text>
          </div>
        ))}
      </div>
    </div>
  );
}

function getCounterPoint(id) {
  if (id === 0) return 3;
  if (id === 1) return 2;
  if (id === 2) return 1;
  if (id === 3) return 0;
}

function onNewPicture() {
  console.info('>>');

  document.querySelector('.jb-file-uploader').click();
}

const EXAMPLES = {
  // Flor: {
  //   src: '/examples/flor.jpg',
  //   ratio: 1,
  //   example: [0.852, 0.001, 1.1312, 0.6366, -0.073, 0.28, 0.148, 0.999],
  //   deep: 40,
  // },
  'Tokyo 1': {
    src: './examples/tokyo1.jpg',
    ratio: 3 / 4,
    example: rndArr([0.15, 0.2, 0.85, 0.2, 0.15, 0.9, 0.85, 0.9]),
    deep: 40,
  },
  'Tokyo 2': {
    src: './examples/tokyo2.jpg',
    ratio: 3 / 4,
    example: rndArr([0.15, 0.2, 0.85, 0.2, 0.15, 0.9, 0.85, 0.9]),
    deep: 40,
  },
  'Tokyo 3': {
    src: './examples/tokyo3.jpg',
    ratio: 3 / 4,
    example: rndArr([0.15, 0.2, 0.85, 0.2, 0.15, 0.9, 0.85, 0.9]),
    deep: 40,
  },
  Stars: {
    src: './examples/stars.jpg',
    ratio: 3 / 4,
    example: rndArr([0.15, 0.2, 0.85, 0.2, 0.15, 0.9, 0.85, 0.9]),
    deep: 40,
  },
  Dotomblurry: {
    src: './examples/dotomblurry.jpg',
    ratio: 3 / 4,
    example: rndArr([0.15, 0.12, 0.85, 0.12, 0.15, 0.87, 0.85, 0.87]),
    deep: 40,
  },
};
const CHOOSEN_EXAMPLE = Math.floor(rnd() * Object.keys(EXAMPLES).length);

function App() {
  const [windowSize, windowSizeSet] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [sourceImage, sourceImageSet] = useState(
    EXAMPLES[Object.keys(EXAMPLES)[CHOOSEN_EXAMPLE]]
  );

  const size = Math.min(
    windowSize.height - TOPNAV_HEIGHT,
    windowSize.width / sourceImage.ratio
  );
  const width = size * sourceImage.ratio;
  const height = size;

  const [showSidebar, showSidebarSet] = useState(false);
  const [drawMode, drawModeSet] = useState('handleDrag');

  const [drosteDeep, drosteDeepSet] = useState(sourceImage.deep || 32);

  // always show if enough space
  const isSidebarAlwaysVisible = window.innerWidth - width > SIDEBAR_WIDTH;

  const finalShowSidebar = isSidebarAlwaysVisible ? true : showSidebar;

  const [currentAnimation, currentAnimationSet] = useState(
    window.GLOBAL_ANIMATION
  );

  const [points, pointSet] = useState([
    { x: width * sourceImage.example[0], y: height * sourceImage.example[1] },
    { x: width * sourceImage.example[2], y: height * sourceImage.example[3] },
    { x: width * sourceImage.example[4], y: height * sourceImage.example[5] },
    { x: width * sourceImage.example[6], y: height * sourceImage.example[7] },
  ]);

  useEffect(() => {
    window.addEventListener('resize', () => {
      windowSizeSet({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      sourceImageSet({ ...EXAMPLES[Object.keys(EXAMPLES)[CHOOSEN_EXAMPLE]] });
    });
  }, []);

  useEffect(() => {
    const size = Math.min(
      window.innerHeight - TOPNAV_HEIGHT,
      window.innerWidth / sourceImage.ratio
    );
    const width = size * sourceImage.ratio;
    const height = size;

    sourceImageSet(sourceImage);
    drosteDeepSet(sourceImage.deep || 32);
    pointSet([
      {
        x: width * sourceImage.example[0],
        y: height * sourceImage.example[1],
      },
      {
        x: width * sourceImage.example[2],
        y: height * sourceImage.example[3],
      },
      {
        x: width * sourceImage.example[4],
        y: height * sourceImage.example[5],
      },
      {
        x: width * sourceImage.example[6],
        y: height * sourceImage.example[7],
      },
    ]);
  }, [sourceImage]);

  function handleDrag({ x, y }, id) {
    pointSet((oldPoints) => {
      const newPoints = [...oldPoints];
      newPoints[id] = { x, y };
      return newPoints;
    });
  }

  function handleDragMirror({ x, y }, id) {
    pointSet((oldPoints) => {
      const newPoints = [...oldPoints];
      newPoints[id] = { x, y };
      newPoints[getCounterPoint(id)] = { x: width - x, y: height - y };
      return newPoints;
    });
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

  function onFileSelected(event) {
    event.stopPropagation();
    event.preventDefault();

    const dt = event.dataTransfer;
    const files = dt ? dt.files : event.target.files;
    const file = files[0];

    const fr = new window.FileReader();

    fr.onload = async (data) => {
      const base64src = data.currentTarget.result;

      const [base64, imageData] = await resizeImage(base64src);

      sourceImageSet({
        src: base64,
        ratio: imageData.originalWidth / imageData.originalHeight,
        example: [0.2, 0.2, 0.8, 0.2, 0.2, 0.8, 0.8, 0.8],
        deep: 20,
      });
    };
    fr.readAsDataURL(file);
  }

  function handleDragLockAspect({ x, y }, id) {
    pointSet((oldPoints) => {
      const newPoints = [...oldPoints];

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

      return newPoints;
    });
  }

  const DRAW_MODE_FUNCTION = {
    handleDrag,
    handleDragMirror,
    handleDragLockAspect,
  };

  const cssTransform = transform2d(
    width,
    height,
    points[0].x,
    points[0].y,
    points[1].x,
    points[1].y,
    points[2].x,
    points[2].y,
    points[3].x,
    points[3].y
  );
  const invertedTransformArray = invertMatrix(cssTransform).flat();

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

  const imageTransformArray = [nullTransformArray];

  for (let imageIdx = 1; imageIdx < drosteDeep; imageIdx++) {
    imageTransformArray.push(
      multmm2(imageTransformArray[imageIdx - 1], cssTransform.flat())
    );
  }

  useEffect(() => {
    window.GLOBAL_ANIMATION = currentAnimation;
  }, [currentAnimation]);

  useEffect(() => {
    const animatableEl = document.querySelector('.main-animatable');

    let progress = 0;

    function animate() {
      if (window.GLOBAL_ANIMATION === 'OUT') {
        progress += 0.009;
        if (progress > 1) progress -= 1;
      } else if (window.GLOBAL_ANIMATION === 'IN') {
        progress -= 0.009;
        if (progress < 0) progress += 1;
      }

      const interpolatedValues = invertedTransformArray.map((el, elIdx) => {
        return el * progress + nullTransformArray[elIdx] * (1 - progress);
      });

      const interpolatedCss = `matrix3d(${interpolatedValues.join(',')})`;
      animatableEl.style.transform = interpolatedCss;

      if (window.GLOBAL_ANIMATION !== 'OFF') {
        window.requestAnimationFrame(animate);
      } else {
        const interpolatedCss = `matrix3d(${nullTransformArray.join(',')})`;
        animatableEl.style.transform = interpolatedCss;
      }
    }
    animate();
  }, [invertedTransformArray, currentAnimation]);

  return (
    <Fragment key={sourceImage.src}>
      <div
        className="main"
        style={{
          top: TOPNAV_HEIGHT,
          left: SHOW_UI ? 0 : (window.innerWidth - width) / 2,
        }}
        onClick={() => {
          showSidebarSet(false);
        }}
      >
        <div
          className="img image-container-cut"
          style={{
            height,
            width,
            overflow: 'hidden',
          }}
        >
          <div className="main-animatable image-container -transformable">
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

        <Draggable
          defaultPosition={points[0]}
          position={points[0]}
          onDrag={(evt, data) => DRAW_MODE_FUNCTION[drawMode](data, 0)}
        >
          <button className="point">0</button>
        </Draggable>

        {drawMode !== 'handleDragLockAspect' && (
          <Draggable
            defaultPosition={points[1]}
            position={points[1]}
            onDrag={(evt, data) => DRAW_MODE_FUNCTION[drawMode](data, 1)}
          >
            <button className="point">1</button>
          </Draggable>
        )}

        {drawMode !== 'handleDragLockAspect' && (
          <Draggable
            defaultPosition={points[2]}
            position={points[2]}
            onDrag={(evt, data) => DRAW_MODE_FUNCTION[drawMode](data, 2)}
          >
            <button className="point">2</button>
          </Draggable>
        )}

        <Draggable
          defaultPosition={points[3]}
          position={points[3]}
          onDrag={(evt, data) => DRAW_MODE_FUNCTION[drawMode](data, 3)}
        >
          <button className="point">3</button>
        </Draggable>
      </div>

      {SHOW_UI && (
        <div className={`sidebar ${finalShowSidebar ? '' : '-hide'}`}>
          <div className="sidebar-element">
            <Dropdown
              label="Controls"
              value={drawMode}
              options={{
                handleDrag: 'Free',
                handleDragMirror: 'Mirror',
                handleDragLockAspect: 'Aspect Lock',
              }}
              onChange={drawModeSet}
            />
          </div>

          <div className="sidebar-element">
            <Dropdown
              label="Depth"
              value={drosteDeep}
              options={{
                2: 2,
                8: 8,
                16: 16,
                32: 32,
                72: 72,
                128: 128,
                256: '256 ⚠️',
              }}
              onChange={(val) => drosteDeepSet(Number(val))}
            />
          </div>

          <div className="sidebar-element">
            <Dropdown
              label="Animation"
              value={currentAnimation}
              options={DEFAULT_ANIMATIONS}
              onChange={currentAnimationSet}
            />
          </div>

          <hr />

          <div className="sidebar-element">
            <Dropdown
              label="Load Example"
              value={null}
              options={Object.keys(EXAMPLES)}
              onChange={(exampleKey) => {
                const exampleObject =
                  EXAMPLES[Object.keys(EXAMPLES)[exampleKey]];
                sourceImageSet(exampleObject);
              }}
            />
          </div>

          <div className="sidebar-element">
            <Text>
              Droste Creator is a tool to create recursive images. Source{' '}
              <A href="https://github.com/javierbyte/droste-creator">Github</A>.
              Code and pictures by <A href="https://javier.xyz">javierbyte</A>.
            </Text>
          </div>

          {false && (
            <div className="sidebar-element">
              <Text>
                {Number(points[0].x / width).toFixed(4)},
                {Number(points[0].y / height).toFixed(4)},
                {Number(points[1].x / width).toFixed(4)},
                {Number(points[1].y / height).toFixed(4)},
                {Number(points[2].x / width).toFixed(4)},
                {Number(points[2].y / height).toFixed(4)},
                {Number(points[3].x / width).toFixed(4)},
                {Number(points[3].y / height).toFixed(4)},
              </Text>
            </div>
          )}
        </div>
      )}

      {SHOW_UI && (
        <div className="topnav">
          <Text style={{ flex: 1, display: 'flex', flexWrap: 'wrap' }}>
            <div>Droste</div>
            <strong>Creator</strong>
          </Text>

          <div style={{ flex: 1 }} />

          <Button onClick={onNewPicture}>New Picture</Button>

          <input
            className="jb-file-uploader"
            type="file"
            onChange={onFileSelected}
            multiple
            accept="image/*"
            aria-label="Drop an image here, or click to select"
          />

          <Space w={1} />

          {!isSidebarAlwaysVisible && (
            <Button
              onClick={() => {
                showSidebarSet(!showSidebar);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </Button>
          )}
        </div>
      )}
    </Fragment>
  );
}

export default App;
