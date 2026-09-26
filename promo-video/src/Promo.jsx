// The 15s timeline. 30 fps -> 450 frames. Change a scene's length here.
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Hook } from "./scenes/Hook.jsx";
import { Score } from "./scenes/Score.jsx";
import { SameWave } from "./scenes/SameWave.jsx";
import { Timeline } from "./scenes/Timeline.jsx";
import { AppPhone } from "./scenes/AppPhone.jsx";
import { WavePayoff } from "./scenes/WavePayoff.jsx";
import { EndCard } from "./scenes/EndCard.jsx";

// ── AUDIO SLOT ───────────────────────────────────────────────────────────
// Drop a track in public/ (e.g. public/music.mp3) and set its name here.
// null = silent video. Keep the music under ~15s or it's cut at the end.
const MUSIC_FILE = null;

export const SCENES = {
  hook: { from: 0, duration: 90 },       // 0-3s
  score: { from: 90, duration: 60 },     // 3-5s
  sameWave: { from: 150, duration: 90 }, // 5-8s  (hero: beginner vs intermediate)
  timeline: { from: 240, duration: 60 }, // 8-10s
  app: { from: 300, duration: 90 },      // 10-13s (phone, then covered by the wave)
  wave: { from: 330, duration: 60 },     // 11-13s
  end: { from: 390, duration: 60 },      // 13-15s
};

export const Promo = () => (
  <AbsoluteFill style={{ background: "#081733" }}>
    <Sequence {...SCENES.hook} name="Hook"><Hook /></Sequence>
    <Sequence {...SCENES.score} name="Score"><Score /></Sequence>
    <Sequence {...SCENES.sameWave} name="Same wave"><SameWave /></Sequence>
    <Sequence {...SCENES.timeline} name="Timeline"><Timeline /></Sequence>
    <Sequence {...SCENES.app} name="App"><AppPhone /></Sequence>
    <Sequence {...SCENES.wave} name="Wave"><WavePayoff /></Sequence>
    <Sequence {...SCENES.end} name="End card"><EndCard /></Sequence>
    {MUSIC_FILE && <Audio src={staticFile(MUSIC_FILE)} />}
  </AbsoluteFill>
);
