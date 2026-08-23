// WebGL renderer for the droste stack.
//
// The four handles define a *projective* transform, not an affine one, so a 2d
// canvas cannot draw this (`setTransform` is affine only). Each layer is drawn
// as a textured quad whose vertex shader keeps the homogeneous w around, which
// is what makes the uv interpolation perspective correct.

import { multmm2, sixteenToNine } from '@/lib/drosteMath.js';

const VERTEX_SHADER = `
attribute vec2 aQuad;

uniform mat3 uMatrix;
uniform vec2 uFrameSize;
uniform vec2 uStageSize;

varying vec2 vUv;

void main() {
  vec3 projected = uMatrix * vec3(aQuad * uFrameSize, 1.0);
  float w = projected.z;

  // Same as converting projected.xy / w to clip space, but kept homogeneous so
  // that the rasterizer gets the perspective divide (and vUv) right.
  gl_Position = vec4(
    2.0 * projected.x / uStageSize.x - w,
    w - 2.0 * projected.y / uStageSize.y,
    0.0,
    w
  );

  vUv = aQuad;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D uTexture;

varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(uTexture, vUv);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Could not compile droste shader: ${log}`);
  }

  return shader;
}

function nextPowerOfTwo(value) {
  let pot = 1;
  while (pot < value) pot *= 2;
  return pot;
}

// webgl1 only filters non power of two textures with NEAREST/LINEAR and no
// mipmaps, and the innermost droste layers are a handful of pixels across --
// without mipmaps they alias into noise.
function toPowerOfTwoCanvas(image, maxSize) {
  const width = Math.min(
    nextPowerOfTwo(image.naturalWidth || image.width),
    maxSize
  );
  const height = Math.min(
    nextPowerOfTwo(image.naturalHeight || image.height),
    maxSize
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);

  return canvas;
}

function hexToRgb(hex) {
  const value = parseInt(hex.replace('#', ''), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

// `releaseContext` force-loses the webgl context on destroy, which is what you
// want for a throwaway export canvas (browsers only keep a handful of contexts
// alive). A canvas that outlives the renderer -- the preview one, which react
// re-mounts in strict mode -- must not do that: a lost context can never be
// used again, and every later shader compile fails against it.
export function createDrosteRenderer(
  canvas,
  { preserveDrawingBuffer = false, releaseContext = true } = {}
) {
  const gl =
    canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer,
    }) ||
    canvas.getContext('experimental-webgl', {
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer,
    });

  if (!gl) throw new Error('WebGL is not available in this browser.');

  const program = gl.createProgram();
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      `Could not link droste program: ${gl.getProgramInfoLog(program)}`
    );
  }

  gl.useProgram(program);

  const aQuad = gl.getAttribLocation(program, 'aQuad');
  const uMatrix = gl.getUniformLocation(program, 'uMatrix');
  const uFrameSize = gl.getUniformLocation(program, 'uFrameSize');
  const uStageSize = gl.getUniformLocation(program, 'uStageSize');

  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(aQuad);
  gl.vertexAttribPointer(aQuad, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const maxTextureSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 2048);

  let hasImage = false;
  let readBuffer = null;

  // Column major, as `uniformMatrix3fv` wants it (webgl1 rejects transpose).
  const matrixBuffer = new Float32Array(9);
  function uploadMatrix(nine) {
    matrixBuffer[0] = nine[0];
    matrixBuffer[1] = nine[3];
    matrixBuffer[2] = nine[6];
    matrixBuffer[3] = nine[1];
    matrixBuffer[4] = nine[4];
    matrixBuffer[5] = nine[7];
    matrixBuffer[6] = nine[2];
    matrixBuffer[7] = nine[5];
    matrixBuffer[8] = nine[8];
    gl.uniformMatrix3fv(uMatrix, false, matrixBuffer);
  }

  return {
    setImage(image) {
      const source = toPowerOfTwoCanvas(image, maxTextureSize);

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR
      );

      hasImage = true;
    },

    // `width`/`height` are the coordinate space the transforms were built in;
    // `pixelRatio` only changes how many device pixels that maps to.
    resize(width, height, pixelRatio = 1) {
      const deviceWidth = Math.max(1, Math.round(width * pixelRatio));
      const deviceHeight = Math.max(1, Math.round(height * pixelRatio));

      if (canvas.width !== deviceWidth) canvas.width = deviceWidth;
      if (canvas.height !== deviceHeight) canvas.height = deviceHeight;

      readBuffer = null;
    },

    draw({ transforms, animated, width, height, background = '#ecf0f1' }) {
      gl.viewport(0, 0, canvas.width, canvas.height);

      const [r, g, b] = hexToRgb(background);
      gl.clearColor(r, g, b, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (!hasImage) return;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.enableVertexAttribArray(aQuad);
      gl.vertexAttribPointer(aQuad, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, texture);

      gl.uniform2f(uFrameSize, width, height);
      gl.uniform2f(uStageSize, width, height);

      // Back to front: layer 0 covers the frame, every next copy sits on top.
      for (let idx = 0; idx < transforms.length; idx++) {
        const layer = animated
          ? multmm2(animated, transforms[idx])
          : transforms[idx];
        uploadMatrix(sixteenToNine(layer));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    },

    // RGBA, top-down (webgl reads bottom-up).
    readPixels() {
      const width = canvas.width;
      const height = canvas.height;
      const rowBytes = width * 4;

      if (!readBuffer) readBuffer = new Uint8Array(rowBytes * height);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, readBuffer);

      const flipped = new Uint8ClampedArray(rowBytes * height);
      for (let row = 0; row < height; row++) {
        flipped.set(
          readBuffer.subarray(row * rowBytes, (row + 1) * rowBytes),
          (height - 1 - row) * rowBytes
        );
      }

      return flipped;
    },

    destroy() {
      gl.deleteBuffer(quadBuffer);
      gl.deleteTexture(texture);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteProgram(program);
      if (releaseContext) gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
