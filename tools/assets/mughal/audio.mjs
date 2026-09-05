import { encodeWav, SAMPLE_RATE } from "../audio.mjs";
export { SAMPLE_RATE };

const TAU = Math.PI * 2;
const DURATION = 28.8;

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2147483648 - 1;
  };
}

function event(buffer, start, duration, voice, gain, loop = false) {
  const offset = Math.round(start * SAMPLE_RATE);
  const length = Math.round(duration * SAMPLE_RATE);
  for (let i = 0; i < length; i++) {
    const at = offset + i;
    const index = loop ? at % buffer.length : at;
    if (index >= buffer.length) break;
    const release = Math.min(1, (length - i) / (SAMPLE_RATE * .06));
    buffer[index] += voice(i / SAMPLE_RATE) * gain * release;
  }
}

function oud(frequency, seed) {
  const noise = randomSource(seed);
  let pick = 0;
  return time => {
    pick = pick * .6 + noise() * .4;
    let tone = 0;
    for (let harmonic = 1; harmonic <= 9; harmonic++) {
      const amplitude = Math.exp(-time * (1.7 + harmonic * .8)) / harmonic ** 1.7;
      const first = Math.sin(TAU * frequency * harmonic * time);
      const second = Math.sin(TAU * frequency * harmonic * 1.0017 * time);
      tone += amplitude * (.65 * first + .35 * second);
    }
    const attack = 1 - Math.exp(-time * 1150);
    const body = Math.sin(TAU * frequency * .5 * time) * Math.exp(-time * 10) * .08;
    return attack * (.75 * tone + body + pick * Math.exp(-time * 90) * .035);
  };
}

function reed(frequency, duration, seed) {
  const noise = randomSource(seed);
  let breath = 0;
  return time => {
    breath = breath * .84 + noise() * .16;
    const attack = Math.sin(Math.min(1, time / .14) * Math.PI / 2);
    const release = Math.min(1, Math.max(0, duration - time) / .28);
    const vibrato = .06 * Math.sin(TAU * 4.7 * time) * Math.min(1, time * 2);
    const scoop = -.3 * (1 - Math.exp(-time * 20));
    const phase = TAU * frequency * time + vibrato + scoop;
    const tone = .72 * Math.sin(phase) + .16 * Math.sin(phase * 2) + .11 * Math.sin(phase * 3) + .025 * Math.sin(phase * 5);
    return attack * release * (tone + breath * .105);
  };
}

function frameDrum(low, seed) {
  const noise = randomSource(seed);
  const frequency = low ? 94 : 223;
  let filtered = 0;
  return time => {
    filtered = filtered * .5 + noise() * .5;
    const attack = 1 - Math.exp(-time * 1700);
    const body = Math.sin(TAU * frequency * time + .4 * (1 - Math.exp(-time * 55))) * Math.exp(-time * (low ? 15 : 29));
    const rim = Math.sin(TAU * frequency * 1.59 * time) * Math.exp(-time * 42);
    const skin = filtered * Math.exp(-time * (low ? 100 : 65));
    return attack * (.68 * body + .2 * rim + skin * (low ? .1 : .4));
  };
}

function brush(seed, duration) {
  const noise = randomSource(seed);
  let low = 0;
  return time => {
    const value = noise();
    low = low * .75 + value * .25;
    const envelope = Math.sin(Math.min(1, time / duration) * Math.PI) ** 2;
    return (value - low) * envelope * (.7 + .3 * Math.sin(TAU * 29 * time));
  };
}

function room(buffer, loop) {
  const dry = buffer.slice();
  for (const [delay, gain] of [[.087, .12], [.173, .08], [.289, .055], [.419, .035]]) {
    const offset = Math.round(delay * SAMPLE_RATE);
    for (let i = 0; i < dry.length; i++) {
      const at = i + offset;
      if (at < dry.length) buffer[at] += dry[i] * gain;
      else if (loop) buffer[at % dry.length] += dry[i] * gain;
    }
  }
}

export function ambientMusic() {
  const samples = new Float64Array(Math.round(DURATION * SAMPLE_RATE));
  const pulse = .4;
  const tonic = 110;
  const mode = [1, 16 / 15, 5 / 4, 4 / 3, 3 / 2, 8 / 5, 16 / 9, 2];
  // The 6-pulse phrases are newly composed, not a quotation of a devotional melody.
  const phrases = [
    [0, 2, 3, 2], [1, 0, 1, 2], [3, 4, 5, 4], [3, 2, 1, 0],
    [0, 3, 4, 3], [2, 1, 0, 1], [2, 4, 6, 5], [4, 3, 2, 1],
    [0, 2, 3, 4], [5, 4, 3, 2], [1, 2, 1, 0], [3, 2, 1, 0],
  ];
  for (let bar = 0; bar < phrases.length; bar++) {
    for (let step = 0; step < 4; step++) {
      const start = (bar * 6 + [0, 2, 3, 5][step]) * pulse;
      const frequency = tonic * 2 * mode[phrases[bar][step]];
      event(samples, start, 2.2, oud(frequency, 1700 + bar * 17 + step), step === 0 ? .105 : .077, true);
    }
    event(samples, bar * 6 * pulse, .45, frameDrum(true, 3200 + bar), .071, true);
    event(samples, (bar * 6 + 3) * pulse, .28, frameDrum(false, 3400 + bar), .047, true);
    event(samples, (bar * 6 + 5) * pulse, .25, frameDrum(false, 3600 + bar), .027, true);
    if (bar % 3 === 2) event(samples, (bar * 6 + 4.5) * pulse, .2, brush(3800 + bar, .2), .019, true);
  }
  const lead = [
    [7, 3, 1.25], [10, 2, .95], [13, 1, 1.4], [17, 0, 1.3],
    [25, 4, 1.4], [29, 5, 1.1], [32, 4, 1.2], [35, 3, 1.1],
    [43, 2, 1.2], [46, 3, .95], [49, 4, 1.5], [54, 2, 1.3],
    [61, 1, 1.4], [65, 2, 1.05], [68, 0, 1.45],
  ];
  lead.forEach(([at, note, duration], index) => {
    event(samples, at * pulse, duration, reed(tonic * 4 * mode[note], duration, 4200 + index), .062, true);
  });
  // These frequencies and the slow amplitude motion close on whole cycles.
  for (let i = 0; i < samples.length; i++) {
    const time = i / SAMPLE_RATE;
    const swell = .83 + .17 * Math.cos(TAU * time / DURATION * 3);
    samples[i] += swell * (.018 * Math.sin(TAU * tonic * time) + .012 * Math.sin(TAU * tonic * 1.5 * time));
  }
  room(samples, true);
  return encodeWav(samples, .42, true);
}

export function soundEffects() {
  const shuffle = new Float64Array(Math.round(.9 * SAMPLE_RATE));
  for (let i = 0; i < 6; i++) {
    event(shuffle, .025 + i * .12, .14, brush(6100 + i, .14), .13);
    event(shuffle, .09 + i * .12, .1, frameDrum(false, 6200 + i), .025);
  }
  const draw = new Float64Array(Math.round(.37 * SAMPLE_RATE));
  event(draw, .005, .22, brush(6300, .22), .1);
  event(draw, .04, .29, oud(550, 6301), .085);
  const place = new Float64Array(Math.round(.52 * SAMPLE_RATE));
  event(place, .01, .25, frameDrum(true, 6400), .095);
  event(place, .025, .44, oud(330, 6401), .12);
  const invalid = new Float64Array(Math.round(.58 * SAMPLE_RATE));
  event(invalid, .01, .28, reed(352, .28, 6500), .1);
  event(invalid, .24, .28, reed(330, .28, 6501), .1);
  const victory = new Float64Array(Math.round(4.2 * SAMPLE_RATE));
  [1, 1.25, 4 / 3, 1.5, 2, 1.5, 2].forEach((ratio, index) => {
    event(victory, .08 + index * .27, 2, oud(220 * ratio, 6600 + index), .17);
    if (index % 2 === 0) event(victory, .08 + index * .27, .35, frameDrum(index === 0, 6700 + index), .055);
  });
  event(victory, 1.6, 1.8, reed(440, 1.8, 6800), .11);
  room(victory, false);
  return {
    shuffle: encodeWav(shuffle, .32),
    draw: encodeWav(draw, .29),
    place: encodeWav(place, .34),
    invalid: encodeWav(invalid, .27),
    victory: encodeWav(victory, .46),
  };
}
