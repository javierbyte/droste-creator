// Geometry shared by the live preview and the exporter.
//
// Transforms are kept in the 16 element, column major form that css matrix3d
// uses, because that is what `transform2d` and `invertMatrix` speak. The 3x3
// projective form (`nine`) is what the actual math and the webgl shader want.

export const NULL_TRANSFORM = [
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
];

// Depth is automatic: copies are added until the newest one is about
// `minLayerPx` across, with `maxDepth` as the hard ceiling.
export const PREVIEW_DEPTH = { minDepth: 2, minLayerPx: 8, maxDepth: 64 };

// The loop seam lives in the innermost layer (see `computeTransforms`), so
// exports go deeper until that layer is smaller than a pixel.
export const EXPORT_DEPTH = { minDepth: 2, minLayerPx: 0.5, maxDepth: 256 };

export function multmm(a, b) {
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

export function sixteenToNine(sixteen) {
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

export function nineToSixteen(t) {
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

export function multmm2(sixteenA, sixteenB) {
  const nineA = sixteenToNine(sixteenA);
  const nineB = sixteenToNine(sixteenB);

  return nineToSixteen(multmm(nineA, nineB));
}

export function applyTransform(nine, x, y) {
  const w = nine[6] * x + nine[7] * y + nine[8];
  return {
    x: (nine[0] * x + nine[1] * y + nine[2]) / w,
    y: (nine[3] * x + nine[4] * y + nine[5]) / w,
  };
}

export function layerLongestSide(sixteen, width, height) {
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

// The recursive stack [I, T, T^2, ...], stopping once a copy is small enough to
// stop mattering.
//
// The animation slides the whole stack by exactly one step: at progress 1 every
// layer has been multiplied by T^-1, so the frame shows [T^-1, I, T, ... ] --
// the same picture as progress 0, except the innermost copy is missing and the
// new outermost one is hidden behind `I`, which covers the frame. That is why
// the loop is seamless, and why the seam gets invisible only once the innermost
// copy is under a pixel.
export function computeTransforms({
  cssTransform,
  width,
  height,
  minDepth = PREVIEW_DEPTH.minDepth,
  minLayerPx = PREVIEW_DEPTH.minLayerPx,
  maxDepth = PREVIEW_DEPTH.maxDepth,
}) {
  const transforms = [NULL_TRANSFORM];
  if (!(width > 0) || !(height > 0)) return transforms;

  while (transforms.length < maxDepth) {
    const previous = transforms[transforms.length - 1];
    const transform = multmm2(previous, cssTransform);

    transforms.push(transform);

    if (
      transforms.length >= minDepth &&
      layerLongestSide(transform, width, height) <= minLayerPx
    ) {
      break;
    }
  }

  return transforms;
}

// The animated matrix, walking from identity (progress 0) to the inverse of the
// droste step (progress 1).
export function interpolateTransform(invertedTransform, progress) {
  return invertedTransform.map(
    (el, elIdx) => el * progress + NULL_TRANSFORM[elIdx] * (1 - progress)
  );
}
