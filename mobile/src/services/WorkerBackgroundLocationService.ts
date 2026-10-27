export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface WorkerLocationConfig {
  apiBaseUrl: string;
  workerId: string;
  authToken: string;
  intervalMs?: number; // default 30s
  accuracyThresholdMeters?: number; // default 50m
}

export type LocationProvider = () => Promise<Coordinates>;

export class WorkerBackgroundLocationService {
  private config: WorkerLocationConfig | null = null;
  private isRunning: boolean = false;
  private timer: number | undefined;
  private locationProvider: LocationProvider;

  constructor(locationProvider?: LocationProvider) {
    this.locationProvider =
      locationProvider ||
      (async () => {
        // Fallback for environment without native GPS module
        return {
          latitude: -6.2088,
          longitude: 106.8456,
          accuracy: 10,
        };
      });
  }

  start(config: WorkerLocationConfig): void {
    if (this.isRunning) {
      this.stop();
    }

    this.config = config;
    this.isRunning = true;

    const interval = config.intervalMs ?? 30000;
    const threshold = config.accuracyThresholdMeters ?? 50;

    // Send first ping immediately
    void this.performPing(threshold);

    // Schedule regular background interval (30s)
    this.timer = setInterval(() => {
      void this.performPing(threshold);
    }, interval);
  }

  stop(): void {
    this.isRunning = false;
    clearInterval(this.timer);
    this.timer = undefined;
    this.config = null;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  private async performPing(threshold: number): Promise<boolean> {
    if (!this.isRunning || !this.config) return false;

    try {
      const coords = await this.locationProvider();

      // Discard location updates with accuracy worse than 50 meters
      if (coords.accuracy > threshold) {
        return false;
      }

      const res = await fetch(`${this.config.apiBaseUrl}/workers/location/ping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.authToken}`,
        },
        body: JSON.stringify({
          workerId: this.config.workerId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        }),
      });

      return res.ok;
    } catch {
      return false;
    }
  }
}

export const workerBackgroundLocationService = new WorkerBackgroundLocationService();
