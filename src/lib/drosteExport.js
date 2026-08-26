// Turns the droste stack into a downloadable gif, mp4 or png.
//
// Every animated export covers a whole number of animation cycles, and the
// frame at progress 1 is never emitted because it is the same picture as frame
// 0 -- that is what makes the result loop seamlessly.

import transform2d from '@/lib/4point.js';
import invertMatrix from '@/lib/invertMatrix.js';
import {
  computeTransforms,
  interpolateTransform,
  transformZoom,
  DEFAULT_ZOOM_EASING,
  EXPORT_DEPTH,
} from '@/lib/drosteMath.js';
import { createDrosteRenderer } from '@/lib/drosteRender.js';

// Gif frame delays are stored in hundredths of a second, so only frame rates
// that divide 100 stay exact -- anything else drifts against the loop.
export const GIF_FPS = 20;
export const VIDEO_FPS = 30;

const PALETTE_SAMPLE_PIXELS = 262144;

// The encoder is drained this often so its queue of raw frames stays bounded.
// Safari wedges its encoder once a few dozen raw frames are queued behind it,
// but handles one frame at a time fine, so every frame is drained as it goes.
const FLUSH_EVERY_FRAMES = 1;
const ENCODER_STALL_SECONDS = 15;
// The first frame is drained on its own: if the encoder is going to wedge, it
// does so here, cheaply, and we can switch to recording instead.
const ENCODER_PROBE_SECONDS = 6;

// Tried in order; the first one the browser accepts at the export size wins.
const CODEC_CANDIDATES = [
  ['avc', 'avc1.640028'],
  ['avc', 'avc1.4d0028'],
  ['avc', 'avc1.42e01f'],
  ['vp9', 'vp09.00.10.08'],
];

export const FORMATS = {
  gif: { label: 'GIF', extension: 'gif', mimeType: 'image/gif' },
  mp4: { label: 'Video', extension: 'mp4', mimeType: 'video/mp4' },
  png: { label: 'PNG', extension: 'png', mimeType: 'image/png' },
};

export function fpsFor(format) {
  return format === 'gif' ? GIF_FPS : VIDEO_FPS;
}

// h.264 needs even dimensions, and it costs nothing to keep every format on the
// same grid.
export function exportSize({ longestSide, ratio }) {
  const width = ratio >= 1 ? longestSide : longestSide * ratio;
  const height = ratio >= 1 ? longestSide / ratio : longestSide;

  return {
    width: Math.max(2, Math.round(width / 2) * 2),
    height: Math.max(2, Math.round(height / 2) * 2),
  };
}

export function planExport({ cycleSeconds, minSeconds, minLoops, fps }) {
  const framesPerCycle = Math.max(2, Math.round(fps * cycleSeconds));
  // The real cycle length, after snapping to whole frames.
  const cycleDuration = framesPerCycle / fps;
  const loops = Math.max(minLoops, Math.ceil(minSeconds / cycleDuration));

  return {
    framesPerCycle,
    cycleDuration,
    loops,
    totalFrames: framesPerCycle * loops,
    duration: cycleDuration * loops,
  };
}

function progressForFrame(frameIdx, framesPerCycle, direction) {
  const forward = frameIdx / framesPerCycle;
  if (direction !== 'IN') return forward;

  // 'IN' runs the same cycle backwards; the modulo keeps frame 0 at progress 0.
  return ((framesPerCycle - frameIdx) % framesPerCycle) / framesPerCycle;
}

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Nothing in the encode path is allowed to wait forever: a stuck encoder has
// to surface as an error rather than a progress bar that never moves.
function withTimeout(promise, message, seconds = ENCODER_STALL_SECONDS) {
  let timer = null;

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(message)), seconds * 1000);
    }),
  ]);
}

// Signals "this browser's WebCodecs encoder is not usable" rather than "the
// export failed", so the caller knows to record the canvas instead.
function encoderUnusable(reason) {
  const error = new Error(reason);
  error.recordInstead = true;
  return error;
}

function videoBitrate(width, height) {
  // ~0.4 bits per pixel per frame, which is generous for this kind of motion.
  return Math.round(width * height * VIDEO_FPS * 0.4);
}

async function pickCodec(width, height) {
  const bitrate = videoBitrate(width, height);

  for (const [codec, codecString] of CODEC_CANDIDATES) {
    const config = {
      codec: codecString,
      width,
      height,
      bitrate,
      framerate: VIDEO_FPS,
      latencyMode: 'quality',
    };

    try {
      const support = await window.VideoEncoder.isConfigSupported(config);
      if (support && support.supported) {
        return { codec, config: support.config || config };
      }
    } catch {
      // Treat a throwing probe the same as an unsupported one.
    }
  }

  return null;
}

// Everything needed to draw one frame at export resolution.
function createFrameRenderer({
  image,
  points,
  width,
  height,
  background,
  zoomEasing = DEFAULT_ZOOM_EASING,
}) {
  const canvas = document.createElement('canvas');
  const renderer = createDrosteRenderer(canvas, {
    preserveDrawingBuffer: true,
  });

  renderer.setImage(image);
  renderer.resize(width, height, 1);

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

  const invertedTransform = invertMatrix(cssTransform).flat();
  // Measured at export resolution, so it matches what the preview was showing.
  const zoom =
    zoomEasing === 'LINEAR'
      ? transformZoom(invertedTransform, width, height)
      : null;
  const transforms = computeTransforms({
    cssTransform,
    width,
    height,
    ...EXPORT_DEPTH,
  });

  return {
    canvas,
    renderer,
    drawProgress(progress) {
      renderer.draw({
        transforms,
        animated: interpolateTransform(invertedTransform, progress, zoom),
        width,
        height,
        background,
      });
    },
  };
}

async function encodeGif({
  frame,
  width,
  height,
  plan,
  direction,
  onProgress,
}) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

  const { framesPerCycle, loops } = plan;
  const pixelCount = width * height;

  const rgbaFrames = [];
  for (let idx = 0; idx < framesPerCycle; idx++) {
    frame.drawProgress(progressForFrame(idx, framesPerCycle, direction));
    rgbaFrames.push(frame.renderer.readPixels());

    onProgress((idx + 1) / framesPerCycle * 0.55);
    if (idx % 4 === 3) await yieldToBrowser();
  }

  // One palette for the whole animation: smaller file, and no colour flicker
  // between frames.
  const perFrameSamples = Math.max(
    1,
    Math.floor(PALETTE_SAMPLE_PIXELS / framesPerCycle)
  );
  const stride = Math.max(1, Math.floor(pixelCount / perFrameSamples));
  const sampleCount = Math.ceil(pixelCount / stride) * framesPerCycle;
  const sample = new Uint8ClampedArray(sampleCount * 4);

  let sampleAt = 0;
  for (const rgba of rgbaFrames) {
    for (let pixel = 0; pixel < pixelCount; pixel += stride) {
      sample[sampleAt++] = rgba[pixel * 4];
      sample[sampleAt++] = rgba[pixel * 4 + 1];
      sample[sampleAt++] = rgba[pixel * 4 + 2];
      sample[sampleAt++] = 255;
    }
  }

  const palette = quantize(sample.subarray(0, sampleAt), 256, {
    format: 'rgb565',
  });

  const indexedFrames = [];
  for (let idx = 0; idx < framesPerCycle; idx++) {
    indexedFrames.push(applyPalette(rgbaFrames[idx], palette, 'rgb565'));
    rgbaFrames[idx] = null;

    onProgress(0.55 + ((idx + 1) / framesPerCycle) * 0.4);
    if (idx % 4 === 3) await yieldToBrowser();
  }

  const gif = GIFEncoder();
  // gifenc takes milliseconds and rounds to hundredths; GIF_FPS divides 100, so
  // this is exact.
  const delay = 1000 / GIF_FPS;

  for (let loop = 0; loop < loops; loop++) {
    for (let idx = 0; idx < framesPerCycle; idx++) {
      gif.writeFrame(indexedFrames[idx], width, height, {
        palette: loop === 0 && idx === 0 ? palette : undefined,
        delay,
        repeat: 0,
      });
    }
  }

  gif.finish();
  onProgress(1);

  return new Blob([gif.bytes()], { type: FORMATS.gif.mimeType });
}

// --- WebCodecs path: frame exact, used wherever the encoder actually works ---
async function encodeWithWebCodecs({
  frame,
  width,
  height,
  plan,
  direction,
  onProgress,
}) {
  if (typeof window.VideoEncoder === 'undefined') {
    throw encoderUnusable('No WebCodecs VideoEncoder.');
  }

  const picked = await pickCodec(width, height);
  if (!picked) throw encoderUnusable('No supported encoder configuration.');

  const {
    Output,
    Mp4OutputFormat,
    WebMOutputFormat,
    BufferTarget,
    EncodedVideoPacketSource,
    EncodedPacket,
  } = await import('mediabunny');

  const { framesPerCycle, totalFrames } = plan;

  const format =
    picked.codec === 'avc'
      ? new Mp4OutputFormat({ fastStart: 'in-memory' })
      : new WebMOutputFormat();
  const output = new Output({ format, target: new BufferTarget() });

  // Mediabunny is used purely as a muxer here. Its own encoder wrapper waits on
  // the WebCodecs `dequeue` event once a few frames are in flight, and browsers
  // that never fire it leave the export stuck forever -- driving the encoder
  // directly and draining it with `flush` avoids that event entirely.
  const source = new EncodedVideoPacketSource(picked.codec);
  output.addVideoTrack(source, { frameRate: VIDEO_FPS });
  await output.start();

  const encoded = [];
  let encoderError = null;

  const encoder = new window.VideoEncoder({
    output: (chunk, meta) => {
      encoded.push({ packet: EncodedPacket.fromEncodedChunk(chunk), meta });
    },
    error: (error) => {
      encoderError = error;
    },
  });

  encoder.configure(picked.config);

  const frameDuration = Math.round(1e6 / VIDEO_FPS);
  const flushEvery = Math.max(1, Math.min(framesPerCycle, FLUSH_EVERY_FRAMES));

  try {
    for (let idx = 0; idx < totalFrames; idx++) {
      if (encoderError) throw encoderUnusable(encoderError.message);

      frame.drawProgress(
        progressForFrame(idx % framesPerCycle, framesPerCycle, direction)
      );

      const videoFrame = new window.VideoFrame(frame.canvas, {
        timestamp: Math.round((idx * 1e6) / VIDEO_FPS),
        duration: frameDuration,
      });

      try {
        // Each loop starts on a key frame, so players that jump to the start
        // land on one.
        encoder.encode(videoFrame, { keyFrame: idx % framesPerCycle === 0 });
      } finally {
        videoFrame.close();
      }

      // Frame 0 is drained on its own, so an encoder that will never drain is
      // caught in a second rather than after the whole clip has been fed in.
      const isProbe = idx === 0;
      if (isProbe || idx % flushEvery === flushEvery - 1) {
        try {
          await withTimeout(
            encoder.flush(),
            'The video encoder stopped responding.',
            isProbe ? ENCODER_PROBE_SECONDS : ENCODER_STALL_SECONDS
          );
        } catch (error) {
          // Whenever it happens, a stall means this browser's encoder cannot
          // finish the job, so hand the whole export over to the recorder.
          throw encoderUnusable(error.message);
        }
      }

      onProgress(((idx + 1) / totalFrames) * 0.9);
      if (idx % 4 === 3) await yieldToBrowser();
    }

    try {
      await withTimeout(
        encoder.flush(),
        'The video encoder stopped responding while finishing.'
      );
    } catch (error) {
      throw encoderUnusable(error.message);
    }
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }

  if (encoderError) throw encoderUnusable(encoderError.message);
  if (!encoded.length) throw encoderUnusable('The encoder produced no frames.');

  for (let idx = 0; idx < encoded.length; idx++) {
    await source.add(encoded[idx].packet, encoded[idx].meta);
    onProgress(0.9 + ((idx + 1) / encoded.length) * 0.09);
  }

  await withTimeout(
    output.finalize(),
    'Writing the video file stopped responding.'
  );
  onProgress(1);

  const isMp4 = picked.codec === 'avc';
  return {
    blob: new Blob([output.target.buffer], {
      type: isMp4 ? FORMATS.mp4.mimeType : 'video/webm',
    }),
    extension: isMp4 ? 'mp4' : 'webm',
  };
}

const RECORDER_MIME_TYPES = [
  ['mp4', 'video/mp4;codecs=avc1.42E01E'],
  ['mp4', 'video/mp4'],
  ['webm', 'video/webm;codecs=vp9'],
  ['webm', 'video/webm;codecs=vp8'],
  ['webm', 'video/webm'],
];

function pickRecorderMimeType() {
  if (typeof window.MediaRecorder === 'undefined') return null;

  for (const [extension, mimeType] of RECORDER_MIME_TYPES) {
    if (window.MediaRecorder.isTypeSupported(mimeType)) {
      return { extension, mimeType };
    }
  }

  return null;
}

// --- Recording path: used when the WebCodecs encoder will not run -----------
//
// This plays the loop once through in real time and records the canvas, so it
// takes as long as the clip lasts. The frames are still the exact same cycle,
// so the result loops just as cleanly; only the frame timing is left to the
// browser instead of being written by hand.
async function recordVideo({
  frame,
  width,
  height,
  plan,
  direction,
  onProgress,
}) {
  const picked = pickRecorderMimeType();
  if (!picked) {
    throw new Error(
      'This browser cannot export video. Try GIF, or a recent Chrome, Edge ' +
        'or Safari.'
    );
  }

  const { framesPerCycle, totalFrames } = plan;

  frame.drawProgress(progressForFrame(0, framesPerCycle, direction));

  const stream = frame.canvas.captureStream(VIDEO_FPS);
  const recorder = new window.MediaRecorder(stream, {
    mimeType: picked.mimeType,
    videoBitsPerSecond: videoBitrate(width, height),
  });

  const chunks = [];
  let recorderError = null;

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size) chunks.push(event.data);
  };
  recorder.onerror = (event) => {
    recorderError = event.error || new Error('Recording failed.');
  };

  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  recorder.start();

  const frameMs = 1000 / VIDEO_FPS;
  const startedAt = performance.now();

  for (let idx = 0; idx < totalFrames; idx++) {
    if (recorderError) break;

    frame.drawProgress(
      progressForFrame(idx % framesPerCycle, framesPerCycle, direction)
    );

    // Pace against a fixed deadline so setTimeout jitter cannot accumulate.
    const wait = startedAt + (idx + 1) * frameMs - performance.now();
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, wait)));

    onProgress(((idx + 1) / totalFrames) * 0.97);
  }

  // Hold the last frame for one more frame's worth of time, otherwise the
  // recorder tends to clip it and the clip ends a frame short of a whole cycle.
  await new Promise((resolve) => setTimeout(resolve, frameMs));

  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  await stopped;

  if (recorderError) throw new Error(recorderError.message);
  if (!chunks.length) throw new Error('Recording produced no video data.');

  onProgress(1);

  return {
    blob: new Blob(chunks, { type: picked.mimeType }),
    extension: picked.extension,
  };
}

async function encodeVideo(options) {
  try {
    return await encodeWithWebCodecs(options);
  } catch (error) {
    if (!error || !error.recordInstead) throw error;
    options.onProgress(0);
    return await recordVideo(options);
  }
}

function encodePng({ frame }) {
  frame.drawProgress(0);

  return new Promise((resolve, reject) => {
    frame.canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode the png.'));
    }, FORMATS.png.mimeType);
  });
}

export async function exportDroste({
  format,
  image,
  points,
  ratio,
  longestSide,
  cycleSeconds,
  direction,
  zoomEasing,
  minSeconds,
  minLoops,
  background,
  onProgress = () => {},
}) {
  const { width, height } = exportSize({ longestSide, ratio });
  const frame = createFrameRenderer({
    image,
    points,
    width,
    height,
    background,
    zoomEasing,
  });

  try {
    if (format === 'png') {
      const blob = await encodePng({ frame });
      onProgress(1);
      return { blob, extension: 'png' };
    }

    const plan = planExport({
      cycleSeconds,
      minSeconds,
      minLoops,
      fps: fpsFor(format),
    });

    if (format === 'gif') {
      const blob = await encodeGif({
        frame,
        width,
        height,
        plan,
        direction,
        onProgress,
      });
      return { blob, extension: 'gif' };
    }

    return await encodeVideo({
      frame,
      width,
      height,
      plan,
      direction,
      onProgress,
    });
  } finally {
    frame.renderer.destroy();
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Give the browser a moment to start the download before dropping the url.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
