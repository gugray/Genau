import {toJson} from "really-relaxed-json";
import {Editor} from "./editor.js";
import {EuclideanSequencer} from "./sequencer.js";
import * as H from "./history.js";
import * as Tone from "tone";

let elmControl;
let toneStarted = false;
let players;
let synth;
let editor;
let compo;
let seq0, seq1, seq2, seq3;
let stepIx = 0;
let muted = false;

const innerMute = "<u>M</u>ute";
const innerUnmute = "Un<u>m</u>ute";

const sampleParams = [
  {name: "s-kick", "midi": 36, "path": "sounds/kick.mp3"},
  {name: "s-snare", "midi": 37, "path": "sounds/snare2.mp3"},
  {name: "s-rim", "midi": 38, "path": "sounds/rim.mp3"},
  {name: "s-closedhat", "midi": 39, "path": "sounds/closedhat.mp3"},
  {name: "s-openhat", "midi": 40, "path": "sounds/openhat.mp3"},
  {name: "s-shaker", "midi": 41, "path": "sounds/shaker1.mp3"},
  {name: "s-floor", "midi": 42, "path": "sounds/floor.mp3"},
  {name: "s-tom", "midi": 43, "path": "sounds/tom.mp3"},
  {name: "s-tamb", "midi": 44, "path": "sounds/tamb.mp3"},
  {name: "s-cowbell", "midi": 45, "path": "sounds/cowbell2.mp3"},
  {name: "s-ridebell", "midi": 46, "path": "sounds/ridebell.mp3"},
  {name: "s-ridecymbal", "midi": 47, "path": "sounds/ridecymbal2.mp3"},
  {name: "s-crash", "midi": 48, "path": "sounds/crash1.mp3"},
];

const defaultSource = `
// C  C#  D  Eb  E  F  F#  G  Ab  A  Bb  B
// C minor penta:    C  Eb F  G  Bb
// C harmonic minor: C  D  Eb F  G  Ab B
// C blues:          C  Eb F  F# G  Bb
// C arabic:         C  C# E  F  G  Ab B
// C hungarian roma: C  D  Eb F# G  Ab B

// s-kick, s-snare, s-rim, s-closedhat, s-openhat, s-shaker, s-floor,
// s-tom, s-tamb, s-cowbell, s-ridebell, s-ridecymbal, s-crash

{
  tempo: 120,
  steps: 16,
  chord: ["C4", "E4b", "F4", "F4#", "G4", "B4b"],
  seq0: { pulses: 4, offset: 0, note: "s-kick" },
  seq1: { pulses: 3, offset: 1, note: "A4b" },
  seq2: { pulses: 7, offset: 3, note: "F4b" },
}
`;

document.addEventListener("DOMContentLoaded", async () => {

  elmControl = document.getElementById("lnkControl");
  initEditor();
  players = await loadSamples(sampleParams);
  players.toDestination();

  elmControl.addEventListener("click", async e => {
    e.preventDefault();
    e.stopPropagation();
    if (!toneStarted) {
      toneStarted = true;
      await initAudio();
      await updateGenerator();
    }
    else toggleMute();
  });
});

function initEditor() {

  const elmEditorBox = document.getElementById("editorBox");
  elmEditorBox.style.display = "block";

  let source;
  const lastSource = H.getLatestVersion();
  if (lastSource != null) source = lastSource;
  else {
    source = defaultSource;
    H.storeVersion(source);
  }
  editor = new Editor(elmEditorBox, source);
  compo = JSON.parse(toJson(source));

  editor.onSubmit = async () => {
    const compoSource = editor.cm.doc.getValue();
    compo = JSON.parse(toJson(compoSource));
    H.storeVersion(compoSource);
    if (toneStarted) await updateGenerator();
  };
  //editor.onFullScreen = () => document.documentElement.requestFullscreen();

  document.body.addEventListener("keydown", e => {
    let handled = false;
    if (e.metaKey && e.key == "e") {
      if (editor.cm.hasFocus()) editor.cm.display.input.blur();
      else editor.cm.display.input.focus();
      handled = true;
    }
    if (e.metaKey && e.key == "m") {
      if (toneStarted) toggleMute();
      handled = true;
    }
    if (e.metaKey && e.key == "s") {
      H.saveHistory(e.shiftKey);
      handled = true;
    }
    if (handled) {
      e.preventDefault();
      return false;
    }
  });
}

function toggleMute() {
  muted = !muted;
  elmControl.innerHTML = muted ? innerUnmute : innerMute;
}

async function updateGenerator() {
  Tone.Transport.bpm.value = compo.tempo;
  if (!compo.seq0) seq0 = null;
  else seq0 = new EuclideanSequencer(compo.steps, compo.seq0.pulses, compo.seq0.offset);
  if (!compo.seq1) seq1 = null;
  else seq1 = new EuclideanSequencer(compo.steps, compo.seq1.pulses, compo.seq1.offset);
  if (!compo.seq2) seq2 = null;
  else seq2 = new EuclideanSequencer(compo.steps, compo.seq2.pulses, compo.seq2.offset);
  if (!compo.seq3) seq3 = null;
  else seq3 = new EuclideanSequencer(compo.steps, compo.seq3.pulses, compo.seq3.offset);

}

async function initAudio() {

  await Tone.start();
  elmControl.innerHTML = innerMute;

  const reverb = new Tone.Reverb({
    decay: 4,
    wet: 0.2,
    preDelay: 0.25
  });
  await reverb.generate();
  const effect = new Tone.FeedbackDelay("8n", 1 / 3);
  effect.wet.value = 0.2;
  synth = new Tone.PolySynth(Tone.DuoSynth, {
    voice0: {
      oscillator: {
        type: "triangle4",
        //partials: [4,3,2,0],
      },
      volume: -30,
      envelope: {
        attack: 0.005,
        release: 0.05,
        sustain: 1
      }
    },
    voice1: {
      oscillator: {
        type: "sine",
      },
      volume: -10,
    }
  });
  synth.volume.value = -10;
  synth.toDestination();
  synth.connect(effect);
  effect.connect(reverb);
  reverb.toDestination();

  Tone.Transport.bpm.value = 120;
  Tone.Transport.scheduleRepeat(time => onStep(time), "8n");
  Tone.Transport.start();
}

function onStep(time) {

  const tones = [];
  const samples = [];

  const addSeqNote = (seqIx) => {

    let seq, noteDef;
    if (seqIx == 0 && seq0) [seq, noteDef] = [seq0, compo.seq0.note];
    else if (seqIx == 1 && seq1) [seq, noteDef] = [seq1, compo.seq1.note];
    else if (seqIx == 2 && seq2) [seq, noteDef] = [seq2, compo.seq2.note];
    else if (seqIx == 3 && seq3) [seq, noteDef] = [seq3, compo.seq3.note];
    if (!seq || !seq.isPulse(stepIx)) return;

    if (noteDef == "chord-seq") tones.push(compo.chord[stepIx % compo.chord.length]);
    else if (noteDef.startsWith("s-") && samples.indexOf(noteDef) == -1) samples.push(noteDef);
    else tones.push(noteDef);
  }

  addSeqNote(0);
  addSeqNote(1);
  addSeqNote(2);
  addSeqNote(3);

  if (!muted) {
    synth.triggerAttackRelease(tones, "16n", time, 2);
    for (const s of samples) {
      if (!players.has(s)) continue;
      players.player(s).start(time);
    }
  }

  stepIx += 1;
}

function loadSamples(params) {
  return new Promise(function (resolve, reject) {
    let res;
    let onload = () => resolve(res);
    let onerror = err => {
      console.log("Failed to load players. Error follows.");
      console.log(err);
    }
    const urls = {};
    for (const sp of sampleParams) urls[sp.name] = sp.path;
    res = new Tone.Players({urls, onload, onerror});
  });
}
