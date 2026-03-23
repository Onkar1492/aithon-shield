# Feature 8: Mobile App Scan Service

**Feature ID:** FEATURE-08  
**Status:** PENDING  
**Priority:** HIGH  
**Estimated Time:** 10-12 hours  
**Dependencies:** Features 2-4 (Types, Security Analyzer, Secrets Detector)  
**Related Todos:** Task 4

---

## Overview

Create comprehensive mobile application binary analysis service that extracts APK/IPA files, parses manifests, analyzes binaries, and detects security issues.

---

## Requirements

### Functions to Implement

1. **`downloadMobileApp(appUrl: string, progressCallback?: ProgressCallback): Promise<string>`**
   - Downloads APK/IPA file
   - Progress tracking for download

2. **`extractAPK(apkPath: string, progressCallback?: ProgressCallback): Promise<APKContent>`**
   - Extracts Android APK (ZIP format)
   - Extracts AndroidManifest.xml
   - Extracts resources

3. **`extractIPA(ipaPath: string, progressCallback?: ProgressCallback): Promise<IPAContent>`**
   - Extracts iOS IPA (ZIP format)
   - Extracts Info.plist
   - Extracts binary

4. **`parseAndroidManifest(manifestPath: string): Promise<ManifestContent>`**
   - Parses AndroidManifest.xml
   - Extracts permissions, components

5. **`parseIOSInfoPlist(plistPath: string): Promise<InfoPlistContent>`**
   - Parses Info.plist
   - Extracts URL schemes, permissions

6. **`analyzeAPIBinary(binaryPath: string, progressCallback?: ProgressCallback): Promise<Vulnerability[]>`**
   - Analyzes binary for API endpoints
   - Extracts strings from binary
   - Detects hardcoded URLs, keys

7. **`scanMobileApp(appUrl: string, platform: 'ios' | 'android', config: MobileScanConfig, progressCallback?: ProgressCallback): Promise<ScanResult>`**
   - Main mobile scan function
   - Orchestrates all analysis
   - Returns complete results

---

## Implementation Details

### Files to Create

1. **`server/services/mobileScanService.ts`**
   - Main mobile scan service

2. **`server/services/androidAnalyzer.ts`**
   - Android-specific analysis

3. **`server/services/iosAnalyzer.ts`**
   - iOS-specific analysis

4. **`server/services/mobileBinaryAnalyzer.ts`**
   - Binary analysis logic

### Dependencies Required

- `unzipper` - APK/IPA extraction
- `plist` - iOS Info.plist parsing
- `xml2js` - AndroidManifest.xml parsing

### Platform-Specific Checks

**Android:**
- `android:debuggable` flag
- Insecure WebView usage
- Missing ProGuard/R8 obfuscation
- Exposed content providers
- Excessive permissions

**iOS:**
- App Transport Security (ATS) configuration
- Insecure URL schemes
- Missing encryption
- Insecure data storage

---

## Function Signatures

```typescript
export interface APKContent {
  manifestPath: string;
  resourcesPath: string;
  classesPath: string;
}

export interface IPAContent {
  plistPath: string;
  binaryPath: string;
  resourcesPath: string;
}

export interface ManifestContent {
  permissions: string[];
  exportedComponents: string[];
  debuggable: boolean;
}

export interface InfoPlistContent {
  urlSchemes: string[];
  permissions: string[];
  atsEnabled: boolean;
}

export async function downloadMobileApp(
  appUrl: string,
  progressCallback?: ProgressCallback
): Promise<string>;

export async function extractAPK(
  apkPath: string,
  progressCallback?: ProgressCallback
): Promise<APKContent>;

export async function extractIPA(
  ipaPath: string,
  progressCallback?: ProgressCallback
): Promise<IPAContent>;

export async function parseAndroidManifest(
  manifestPath: string
): Promise<ManifestContent>;

export async function parseIOSInfoPlist(
  plistPath: string
): Promise<InfoPlistContent>;

export async function analyzeAPIBinary(
  binaryPath: string,
  progressCallback?: ProgressCallback
): Promise<Vulnerability[]>;

export async function scanMobileApp(
  appUrl: string,
  platform: 'ios' | 'android',
  config: MobileScanConfig,
  progressCallback?: ProgressCallback
): Promise<ScanResult>;
```

---

## Progress Tracking

- **Download** (0-20%): App download progress
- **Extraction** (20-40%): Archive extraction
- **Manifest Parsing** (40-50%): Parse manifest files
- **Binary Analysis** (50-85%): Analyze binary files
- **Secrets Detection** (85-95%): Scan for secrets
- **Finalizing** (95-100%): Results aggregation

---

## Error Handling

- Invalid file format: Validate before processing
- Download failures: Retry with exponential backoff
- Extraction failures: Handle corrupted archives
- Missing manifests: Return clear error

---

## Testing

### Test Cases

1. **APK Analysis**
   - Test APK extraction
   - Test manifest parsing
   - Test binary analysis
   - Test secrets detection

2. **IPA Analysis**
   - Test IPA extraction
   - Test Info.plist parsing
   - Test binary analysis
   - Test ATS checks

3. **Full Scan**
   - Test end-to-end scan
   - Test progress tracking
   - Test error handling
   - Test both platforms

---

## Acceptance Criteria

- [ ] APK extraction and analysis works
- [ ] IPA extraction and analysis works
- [ ] Manifest parsing accurate
- [ ] Binary analysis functional
- [ ] Secrets detection works
- [ ] Progress tracking accurate
- [ ] Error handling comprehensive
- [ ] Unit tests pass
- [ ] Integration tests pass

---

## Notes

- APK and IPA are ZIP formats - use unzipper
- Binary analysis extracts strings for pattern matching
- Uses Secrets Detector service (Feature 4)
- Will be integrated in Feature 11 (Endpoint Updates)

---

## Next Steps

After this feature is complete:
- Feature 11: Mobile Endpoint Updates (will use this service)
- Feature 12: Error Handling (will enhance this)
