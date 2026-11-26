export type SFXType =
  | 'bid'
  | 'gavel'
  | 'tick'
  | 'whistle'
  | 'double_whistle'
  | 'card'
  | 'goal_roar'
  | 'xg_swell'
  | 'kick'
  | 'post'
  | 'anthem';

class AudioEngine {
  private ctx: AudioContext | null = null;
  public sfxMuted = false;
  public voiceMuted = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined' || this.sfxMuted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playSFX(type: SFXType): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'bid') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(990, now + 0.09);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (type === 'tick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1120, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'gavel') {
      for (let i = 0; i < 2; i++) {
        const t = now + i * 0.14;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(52, t + 0.11);
        gain.gain.setValueAtTime(0.32, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.13);
      }
    } else if (type === 'whistle' || type === 'double_whistle') {
      const bursts = type === 'double_whistle' ? [0, 0.24] : [0];
      for (const offset of bursts) {
        const t = now + offset;
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(2850, t);
        lfo.frequency.setValueAtTime(42, t);
        lfoGain.gain.setValueAtTime(110, t);
        lfo.connect(lfoGain).connect(osc.frequency);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        lfo.start(t);
        osc.stop(t + 0.19);
        lfo.stop(t + 0.19);
      }
    } else if (type === 'card') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(320, now + 0.1);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'kick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'post') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.3);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.34);
    } else if (type === 'goal_roar' || type === 'xg_swell') {
      const dur = type === 'goal_roar' ? 1.8 : 0.7;
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.55;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(type === 'goal_roar' ? 680 : 520, now);
      filter.Q.setValueAtTime(1.1, now);

      const gain = ctx.createGain();
      const peak = type === 'goal_roar' ? 0.26 : 0.09;
      gain.gain.setValueAtTime(0.005, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + dur);
    } else if (type === 'anthem') {
      // Ceremonial UCL-inspired majestic chord arpeggio
      const freqs = [261.63, 329.63, 392.0, 523.25];
      freqs.forEach((freq, idx) => {
        const t = now + idx * 0.24;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.11, t + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.92);
      });
    }
  }

  public speakCommentary(text: string, priority = false): void {
    if (
      typeof window === 'undefined' ||
      this.voiceMuted ||
      !('speechSynthesis' in window)
    ) {
      return;
    }
    try {
      if (priority) {
        window.speechSynthesis.cancel();
      } else if (window.speechSynthesis.speaking) {
        return;
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.07;
      utter.pitch = 1.02;
      utter.volume = 0.85;
      window.speechSynthesis.speak(utter);
    } catch {
      // ignore speech synthesis restrictions
    }
  }

  public stopSpeech(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }
}

export const audioEngine = new AudioEngine();
