export interface LocationPayload {
  latitude: number;
  longitude: number;
  accuracy: number;
  isMock?: boolean; // Android Location.isFromMockProvider
  mockLocationsEnabled?: boolean;
}

export interface MockLocationCheckResult {
  isMockLocation: boolean;
  reason?: string;
}

export class MockLocationDetector {
  /**
   * Evaluates location reading for spoofing or mock provider indicators
   */
  static evaluateLocation(location: LocationPayload): MockLocationCheckResult {
    // 1. Android explicit mock provider flag
    if (location.isMock === true) {
      return {
        isMockLocation: true,
        reason: 'Android mock provider flag detected (Location.isFromMockProvider = true)',
      };
    }

    if (location.mockLocationsEnabled === true) {
      return {
        isMockLocation: true,
        reason: 'Mock location provider enabled on system settings',
      };
    }

    // 2. Implausible accuracy (0.00m exactly is typical for mock APK software)
    if (location.accuracy === 0) {
      return {
        isMockLocation: true,
        reason: 'Suspicious 0.00m GPS accuracy indicating software injection',
      };
    }

    return {
      isMockLocation: false,
    };
  }

  /**
   * Sanitizes worker ping pipeline: suppresses ping & triggers offline if mock detected
   */
  static processWorkerPing(
    location: LocationPayload,
    onValidPing: () => Promise<void>,
    onMockDetected: (reason: string) => Promise<void>
  ): Promise<void> {
    const check = this.evaluateLocation(location);
    if (check.isMockLocation) {
      return onMockDetected(check.reason || 'Mock location detected');
    }
    return onValidPing();
  }
}
