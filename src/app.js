import {toJson} from "really-relaxed-json";
import {Editor} from "./editor.js";
import * as H from "./history.js";
import * as Tone from "tone";

let elmControl;
let toneStarted = false;
let players;
let synth;
let editor;
let compo;
let notePos = 0;
let muted = false;

const innerMute = "<u>M</u>ute";
const innerUnmute = "Un<u>m</u>ute";

const sampleParams = [
  {name: "kick", "midi": 36, "path": "sounds/kick.mp3"},
  {name: "snare", "midi": 37, "path": "sounds/snare2.mp3"},
  {name: "rim", "midi": 38, "path": "sounds/rim.mp3"},
  {name: "closedhat", "midi": 39, "path": "sounds/closedhat.mp3"},
  {name: "openhat", "midi": 40, "path": "sounds/openhat.mp3"},
  {name: "shaker", "midi": 41, "path": "sounds/shaker1.mp3"},
  {name: "floor", "midi": 42, "path": "sounds/floor.mp3"},
  {name: "tom", "midi": 43, "path": "sounds/tom.mp3"},
  {name: "tamb", "midi": 44, "path": "sounds/tamb.mp3"},
  {name: "cowbell", "midi": 45, "path": "sounds/cowbell2.mp3"},
  {name: "ridebell", "midi": 46, "path": "sounds/ridebell.mp3"},
  {name: "ridecymbal", "midi": 47, "path": "sounds/ridecymbal2.mp3"},
  {name: "crash", "midi": 48, "path": "sounds/crash1.mp3"},
];

const defaultSource = `{
  tempo: 120,
  steps: 16,
  seq1: { pulses: 3, offset: 0 },
}`

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

  editor.onSubmit = () => {
    const compoSource = editor.cm.doc.getValue();
    compo = JSON.parse(toJson(compoSource));
    H.storeVersion(compoSource);
    Tone.Transport.bpm.value = compo.tempo;
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
  if ((notePos % 2) == 0) tones.push("A3");
  if (notePos == 0) tones.push("D4");

  if (!muted) {
    synth.triggerAttackRelease(tones, "16n", time, 2);
  }

  notePos = (notePos + 1) % compo.steps;
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
