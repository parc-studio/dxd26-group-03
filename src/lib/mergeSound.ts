/** Soft click/chime via Web Audio — no asset file required. */
export function playMergeSound(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime

    const makeTone = (freq: number, start: number, dur: number, gain: number) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, start)
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(gain, start + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(g)
      g.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + dur + 0.02)
    }

    makeTone(880, now, 0.08, 0.045)
    makeTone(1320, now + 0.05, 0.12, 0.03)

    window.setTimeout(() => {
      void ctx.close()
    }, 400)
  } catch {
    /* audio optional */
  }
}
