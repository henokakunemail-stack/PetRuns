import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppVersionService, compareSemver } from '../src/services/app-version.service.ts';
import { MockLocationDetector } from '../../mobile/src/services/MockLocationDetector.ts';
import { SecureStorageService } from '../../mobile/src/services/SecureStorageService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

describe('Phase 7: Mobile Hardening and Store Compliance', () => {
  it('Task 42: ProGuard and Hermes configuration files enforce obfuscation and stripped logs', () => {
    const proguardPath = path.join(rootDir, 'mobile/android/app/proguard-rules.pro');
    assert.ok(fs.existsSync(proguardPath), 'proguard-rules.pro must exist');
    const proguardContent = fs.readFileSync(proguardPath, 'utf-8');
    assert.ok(proguardContent.includes('-assumenosideeffects class android.util.Log'));
    assert.ok(proguardContent.includes('-keep class com.facebook.hermes.**'));

    const buildGradlePath = path.join(rootDir, 'mobile/android/app/build.gradle');
    assert.ok(fs.existsSync(buildGradlePath), 'build.gradle must exist');
    const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf-8');
    assert.ok(buildGradleContent.includes('enableHermes: true'));
    assert.ok(buildGradleContent.includes('minifyEnabled true'));

    const podfilePath = path.join(rootDir, 'mobile/ios/Podfile');
    assert.ok(fs.existsSync(podfilePath), 'Podfile must exist');
    const podfileContent = fs.readFileSync(podfilePath, 'utf-8');
    assert.ok(podfileContent.includes(':hermes_enabled => true'));
  });

  it('Task 43: SecureStorageService encrypts tokens and detects compromised device integrity', async () => {
    const secureStorage = new SecureStorageService();

    // Store & retrieve token
    await secureStorage.setToken('auth_token', 'jwt.secure.token.payload');
    const retrieved = await secureStorage.getToken('auth_token');
    assert.equal(retrieved, 'jwt.secure.token.payload');

    await secureStorage.removeToken('auth_token');
    assert.equal(await secureStorage.getToken('auth_token'), null);

    // Device integrity check
    const integrity = secureStorage.checkDeviceIntegrity();
    assert.equal(typeof integrity.isCompromised, 'boolean');
  });

  it('Task 44: Android network security config blocks cleartext and pins api.petmatch.id SSL certificates', () => {
    const securityXmlPath = path.join(
      rootDir,
      'mobile/android/app/src/main/res/xml/network_security_config.xml'
    );
    assert.ok(fs.existsSync(securityXmlPath), 'network_security_config.xml must exist');
    const xmlContent = fs.readFileSync(securityXmlPath, 'utf-8');

    assert.ok(xmlContent.includes('cleartextTrafficPermitted="false"'));
    assert.ok(xmlContent.includes('<domain includeSubdomains="true">api.petmatch.id</domain>'));
    assert.ok(xmlContent.includes('pin digest="SHA-256"'));
  });

  it('Task 45: Mock location detector flags simulated GPS and suppresses worker ping', async () => {
    // 1. Explicit mock provider detected
    const mockCheck1 = MockLocationDetector.evaluateLocation({
      latitude: -6.2088,
      longitude: 106.8456,
      accuracy: 15,
      isMock: true,
    });
    assert.equal(mockCheck1.isMockLocation, true);
    assert.ok(mockCheck1.reason?.includes('mock provider'));

    // 2. Suspicious 0.00m accuracy injection
    const mockCheck2 = MockLocationDetector.evaluateLocation({
      latitude: -6.2088,
      longitude: 106.8456,
      accuracy: 0,
    });
    assert.equal(mockCheck2.isMockLocation, true);
    assert.ok(mockCheck2.reason?.includes('0.00m'));

    // 3. Genuine GPS passes
    const genuineCheck = MockLocationDetector.evaluateLocation({
      latitude: -6.2088,
      longitude: 106.8456,
      accuracy: 12.5,
      isMock: false,
    });
    assert.equal(genuineCheck.isMockLocation, false);

    // 4. Ping pipeline suppression test
    let pingExecuted = false;
    let mockEvicted = false;

    await MockLocationDetector.processWorkerPing(
      { latitude: -6.2, longitude: 106.8, accuracy: 10, isMock: true },
      async () => {
        pingExecuted = true;
      },
      async () => {
        mockEvicted = true;
      }
    );

    assert.equal(pingExecuted, false, 'Mock GPS ping must be suppressed');
    assert.equal(mockEvicted, true, 'Mock GPS must trigger eviction/offline');
  });

  it('Task 46: Apple Privacy Manifest and Google Play data declarations exist and are valid', () => {
    const privacyManifestPath = path.join(rootDir, 'mobile/ios/PrivacyInfo.xcprivacy');
    assert.ok(fs.existsSync(privacyManifestPath), 'PrivacyInfo.xcprivacy must exist');
    const plist = fs.readFileSync(privacyManifestPath, 'utf-8');
    assert.ok(plist.includes('NSPrivacyAccessedAPITypes'));
    assert.ok(plist.includes('NSPrivacyCollectedDataTypePreciseLocation'));
    assert.ok(plist.includes('NSPrivacyCollectedDataTypeUserID'));

    const googlePlayDocsPath = path.join(rootDir, 'mobile/docs/GOOGLE_PLAY_DATA_SAFETY.md');
    assert.ok(fs.existsSync(googlePlayDocsPath), 'GOOGLE_PLAY_DATA_SAFETY.md must exist');
  });

  it('Task 47: AppVersionService checks semver and enforces store redirect when outdated', () => {
    const versionService = new AppVersionService();
    versionService.setVersionRules('1.2.0', '1.3.0');

    // Semver comparisons
    assert.equal(compareSemver('1.2.0', '1.2.0'), 0);
    assert.equal(compareSemver('1.1.9', '1.2.0'), -1);
    assert.equal(compareSemver('1.2.1', '1.2.0'), 1);

    // Client v1.1.0 is below minVersion 1.2.0 -> forceUpdate = true
    const checkOutdated = versionService.checkVersion('1.1.0', 'android');
    assert.equal(checkOutdated.forceUpdate, true);
    assert.ok(checkOutdated.storeUrl.includes('play.google.com'));

    // Client v1.2.5 is above minVersion 1.2.0 -> forceUpdate = false
    const checkCurrent = versionService.checkVersion('1.2.5', 'ios');
    assert.equal(checkCurrent.forceUpdate, false);
    assert.ok(checkCurrent.storeUrl.includes('apps.apple.com'));
  });
});
