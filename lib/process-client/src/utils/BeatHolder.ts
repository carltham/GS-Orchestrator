export type BeatCallback = (tickCount: number) => void | Promise<void>;

export class BeatHolder {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private tickCount: number = 0;

  constructor(private bpm: number, private onBeat: BeatCallback) {}

  public start(): void {
    if (this.intervalId) return;

    // Calculate millisecond interval from Beats Per Minute (BPM)
    const msPerBeat = (60 / this.bpm) * 1000;

    this.intervalId = setInterval(async () => {
      this.tickCount++;
      try {
        await this.onBeat(this.tickCount);
      } catch (err) {
        console.error('[BeatHolder] Error during onBeat callback execution:', err);
      }
    }, msPerBeat);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public reset(): void {
    this.stop();
    this.tickCount = 0;
  }
}
