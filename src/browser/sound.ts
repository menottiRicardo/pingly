import { hasDom } from '../shared/env';

export interface SoundOptions {
  /** Audio file to play. Defaults to a short built-in chime. */
  src?: string;
  /** 0–1. Defaults to `0.4`. */
  volume?: number;
}

type AudioContextCtor = typeof AudioContext;

/**
 * A notification sound. Browsers only allow audio after the user has
 * interacted with the page, so `play()` resolves to `false` when blocked.
 */
export function createSound({ src, volume = 0.4 }: SoundOptions = {}) {
  let muted = false;
  let audio: HTMLAudioElement | null = null;
  let context: AudioContext | null = null;

  const chime = async () => {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return false;
    context ??= new Ctor();
    if (context.state === 'suspended') await context.resume();
    if (context.state !== 'running') return false;
    const now = context.currentTime;
    for (const [i, freq] of [880, 1320].entries()) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(context.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    }
    return true;
  };

  return {
    async play(): Promise<boolean> {
      if (muted || !hasDom()) return false;
      try {
        if (!src) return await chime();
        audio ??= new Audio(src);
        audio.volume = volume;
        audio.currentTime = 0;
        await audio.play();
        return true;
      } catch {
        return false;
      }
    },
    setMuted(value: boolean) {
      muted = value;
    },
    get muted() {
      return muted;
    },
  };
}
