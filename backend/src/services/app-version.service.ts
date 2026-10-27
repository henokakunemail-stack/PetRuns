export interface VersionCheckResult {
  currentVersion: string;
  minVersion: string;
  latestVersion: string;
  forceUpdate: boolean;
  storeUrl: string;
  releaseNotes?: string;
}

export function compareSemver(v1: string, v2: string): number {
  const parts1 = v1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = v2.split('.').map((p) => parseInt(p, 10) || 0);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export class AppVersionService {
  private minVersion: string = '1.2.0';
  private latestVersion: string = '1.3.0';
  private androidStoreUrl: string = 'https://play.google.com/store/apps/details?id=com.petmatch.app';
  private iosStoreUrl: string = 'https://apps.apple.com/app/petmatch/id123456789';

  checkVersion(clientVersion: string, platform: 'android' | 'ios' = 'android'): VersionCheckResult {
    // If client version is lower than minimum allowed version -> force update
    const isOutdated = compareSemver(clientVersion, this.minVersion) < 0;
    const storeUrl = platform === 'ios' ? this.iosStoreUrl : this.androidStoreUrl;

    return {
      currentVersion: clientVersion,
      minVersion: this.minVersion,
      latestVersion: this.latestVersion,
      forceUpdate: isOutdated,
      storeUrl,
      releaseNotes: 'Pembaruan keamanan dan performa pelacakan live walk.',
    };
  }

  setVersionRules(minVersion: string, latestVersion: string): void {
    this.minVersion = minVersion;
    this.latestVersion = latestVersion;
  }
}

export const appVersionService = new AppVersionService();
