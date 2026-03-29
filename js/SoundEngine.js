import { FLAP_AUDIO_BASE64 } from './flapAudio.js';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._initialized = false;
    this._audioBuffer = null;
    this._currentSources = [];
    this._fadeGain = null;
  }

  async init() {
    if (this._initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._initialized = true;

    try {
      const binaryStr = atob(FLAP_AUDIO_BASE64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      this._audioBuffer = await this.ctx.decodeAudioData(bytes.buffer);
    } catch (e) {
      console.warn('Failed to decode flap audio:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this._stopAll();
    return this.muted;
  }

  /**
   * Play the transition sound looped to cover the given animation duration.
   * @param {number} animDurationMs - total animation time in milliseconds
   */
  playTransition(animDurationMs) {
    if (!this.ctx || !this._audioBuffer || this.muted) return;
    this.resume();
    this._stopAll();

    const clipDuration = this._audioBuffer.duration;
    const totalSec = (animDurationMs || 3800) / 1000;

    // Master gain for fade-out
    this._fadeGain = this.ctx.createGain();
    this._fadeGain.gain.value = 0.8;
    this._fadeGain.connect(this.ctx.destination);

    // Schedule clips to cover the full animation
    const now = this.ctx.currentTime;
    let offset = 0;
    while (offset < totalSec) {
      const source = this.ctx.createBufferSource();
      source.buffer = this._audioBuffer;
      source.connect(this._fadeGain);
      source.start(now + offset);
      this._currentSources.push(source);
      offset += clipDuration - 0.05;
    }

    // Fade out at the end
    const fadeStart = now + totalSec - 0.4;
    this._fadeGain.gain.setValueAtTime(0.8, Math.max(now, fadeStart));
    this._fadeGain.gain.linearRampToValueAtTime(0, Math.max(now, fadeStart) + 0.4);

    // Clean up
    setTimeout(() => {
      this._stopAll();
    }, (totalSec + 0.5) * 1000);
  }

  _stopAll() {
    for (const source of this._currentSources) {
      try { source.stop(); } catch (e) {}
    }
    this._currentSources = [];
    if (this._fadeGain) {
      try { this._fadeGain.disconnect(); } catch (e) {}
      this._fadeGain = null;
    }
  }

  getTransitionDuration() {
    if (this._audioBuffer) {
      return this._audioBuffer.duration * 1000;
    }
    return 3800;
  }

  scheduleFlaps() {
    this.playTransition();
  }
}
