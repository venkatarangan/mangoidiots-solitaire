export const SAMPLE_RATE = 22_050;
const TAU = Math.PI * 2;

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296 * 2 - 1;
  };
}

function addEvent(buffer, start, duration, voice, amplitude, wrap = false) {
  const offset = Math.round(start * SAMPLE_RATE);
  const length = Math.round(duration * SAMPLE_RATE);
  for (let i = 0; i < length; i++) {
    let index = offset + i;
    if (wrap) index = ((index % buffer.length) + buffer.length) % buffer.length;
    if (index >= 0 && index < buffer.length) {
      const tail = Math.min(1, (length - i) / (SAMPLE_RATE * .045));
      buffer[index] += amplitude * voice(i / SAMPLE_RATE, i) * tail;
    }
  }
}

function pluck(frequency, seed = 1) {
  const random = seeded(seed);
  let lowNoise = 0;
  return (time) => {
    lowNoise = lowNoise * .55 + random() * .45;
    const attack = 1 - Math.exp(-time * 900);
    let tone = 0;
    for (let harmonic = 1; harmonic <= 7; harmonic++) {
      const detune = 1 + (harmonic - 1) * .00015;
      const decay = Math.exp(-time * (.92 + harmonic * .73));
      tone += Math.sin(TAU * frequency * harmonic * detune * time) * decay / harmonic ** 1.6;
    }
    return attack * (tone * .73 + lowNoise * Math.exp(-time * 58) * .05);
  };
}

function flute(frequency, duration, seed) {
  const random = seeded(seed);
  let breath = 0;
  return (time) => {
    breath = breath * .72 + random() * .28;
    const envelope = Math.min(1, time / .12) * Math.min(1, Math.max(0, duration - time) / .23);
    const vibrato = Math.max(0, Math.min(1, (time - .16) * 3)) * .045 * Math.sin(TAU * 4.4 * time);
    const phase = TAU * frequency * time + vibrato;
    return envelope * (.75 * Math.sin(phase) + .12 * Math.sin(phase * 2) + .035 * Math.sin(phase * 3) + breath * .055);
  };
}

function drum(frequency, bright, seed) {
  const random = seeded(seed);
  return (time) => {
    const attack = 1 - Math.exp(-time * 1500);
    const glide = frequency * time + frequency * .08 * (1 - Math.exp(-time * 42)) / 42;
    return attack * (
      Math.sin(TAU * glide) * Math.exp(-time * 16) * .74 +
      Math.sin(TAU * frequency * 1.51 * time) * Math.exp(-time * 25) * .23 +
      Math.sin(TAU * frequency * 2.03 * time) * Math.exp(-time * 37) * .12 +
      random() * Math.exp(-time * (bright ? 85 : 120)) * (bright ? .2 : .08)
    );
  };
}

function paper(seed, duration) {
  const random = seeded(seed);
  let previous = 0;
  let smooth = 0;
  return (time) => {
    const noise = random();
    smooth = smooth * .35 + (noise - previous) * .65;
    previous = noise;
    const envelope = Math.sin(Math.PI * Math.min(1, time / duration)) ** 1.7;
    return smooth * envelope;
  };
}

function reverb(buffer, wrap) {
  const dry = buffer.slice();
  for (const [delay, gain] of [[.073, .15], [.131, .11], [.223, .08], [.347, .045]]) {
    const offset = Math.round(delay * SAMPLE_RATE);
    for (let i = 0; i < dry.length; i++) {
      const index = i + offset;
      if (index < dry.length) buffer[index] += dry[i] * gain;
      else if (wrap) buffer[index % dry.length] += dry[i] * gain;
    }
  }
}

export function encodeWav(samples, peak = .65, loop = false) {
  let dc = 0;
  for (const sample of samples) dc += sample;
  dc /= samples.length;
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.tanh(samples[i] - dc);
    max = Math.max(max, Math.abs(samples[i]));
  }
  const gain = max ? peak / max : 1;
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const edge = loop ? 1 : Math.min(1, i / 220, (samples.length - 1 - i) / 441);
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * gain * edge)) * 32767), 44 + i * 2);
  }
  return buffer;
}

export function ambientMusic() {
  const beat = .8;
  const length = 32 * beat;
  const samples = new Float64Array(Math.round(length * SAMPLE_RATE));
  const tonic = 146.875;
  const scale = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4];
  // Integer-cycle drone and circular event tails make the rendered file itself loopable.
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const sway = 1 + .13 * Math.sin(TAU * t / length * 2);
    samples[i] = sway * (
      .034 * Math.sin(TAU * tonic / 2 * t) +
      .027 * Math.sin(TAU * tonic * t) +
      .014 * Math.sin(TAU * tonic * 1.5 * t)
    );
  }
  const plucks = [
    [0, 0], [1.5, 2], [3, 3], [4, 4], [5.5, 3], [6.5, 2],
    [8, 1], [9.5, 2], [11, 3], [12, 2], [13.5, 1], [15, 0],
    [16, 0], [17, 3], [18.5, 4], [20, 5], [21.5, 4], [23, 3],
    [24, 2], [25.5, 3], [27, 1], [28.5, 2], [30, 1], [31, 0],
  ];
  for (const [index, [at, note]] of plucks.entries()) {
    addEvent(samples, at * beat, 2.5, pluck(tonic * scale[note], 61 + index), .125, true);
  }
  for (const [index, [at, note, duration]] of [
    [2, 3, 1.3], [4, 4, 1.7], [6.4, 3, .95], [9, 2, 1.35],
    [11.5, 1, 1.55], [14, 0, 1.5], [18, 3, 1.4], [20, 5, 1.7],
    [22.5, 4, 1.35], [25, 3, 1.2], [27.2, 2, 1.4], [29.5, 0, 1.65],
  ].entries()) {
    addEvent(samples, at * beat, duration, flute(tonic * scale[note] * 2, duration, 101 + index), .075, true);
  }
  for (let cycle = 0; cycle < 4; cycle++) {
    for (const [step, frequency, gain] of [[0, tonic * .75, .1], [2.5, tonic * 1.5, .052], [4, tonic, .071], [6, tonic * 1.5, .047], [7, tonic, .034]]) {
      addEvent(samples, (cycle * 8 + step) * beat, .38, drum(frequency, step !== 0, 500 + cycle * 17 + step * 2), gain, true);
    }
  }
  reverb(samples, true);
  return encodeWav(samples, .43, true);
}

export function soundEffects() {
  const shuffle = new Float64Array(Math.round(.8 * SAMPLE_RATE));
  for (let i = 0; i < 8; i++) {
    addEvent(shuffle, .04 + i * .075, .095, paper(17 + i, .095), .22 * (1 - i * .035));
  }
  const draw = new Float64Array(Math.round(.32 * SAMPLE_RATE));
  addEvent(draw, 0, .19, paper(79, .19), .16);
  addEvent(draw, .035, .25, pluck(660, 83), .09);
  const place = new Float64Array(Math.round(.43 * SAMPLE_RATE));
  addEvent(place, .005, .23, drum(180, false, 87), .13);
  addEvent(place, .025, .36, pluck(440, 91), .14);
  const invalid = new Float64Array(Math.round(.48 * SAMPLE_RATE));
  addEvent(invalid, .01, .23, flute(293.75, .23, 97), .16);
  addEvent(invalid, .19, .25, flute(220.3125, .25, 101), .14);
  const victory = new Float64Array(Math.round(3.8 * SAMPLE_RATE));
  const phrase = [1, 1.25, 1.5, 5 / 3, 2, 1.5, 2];
  phrase.forEach((ratio, i) => {
    addEvent(victory, .1 + i * .25, 1.8, pluck(293.75 * ratio, 120 + i), .2);
    if (i % 2 === 0) addEvent(victory, .1 + i * .25, .35, drum(146.875, true, i + 191), .07);
  });
  addEvent(victory, 1.6, 1.5, flute(587.5, 1.5, 229), .13);
  reverb(victory, false);
  return {
    shuffle: encodeWav(shuffle, .34),
    draw: encodeWav(draw, .30),
    place: encodeWav(place, .35),
    invalid: encodeWav(invalid, .28),
    victory: encodeWav(victory, .48),
  };
}
