// Quality presets selected with ?q=low|med|high. GPUs limited to
// 16 fragment texture units use the low preset by default; an explicit ?q= still wins.
type QualityPresetName = "low" | "med" | "high";

type QualitySettings = {
  name: QualityPresetName;
  cascades: number;
  shadowMapSize: number;
  shadowFar: number;
  splits: number[];
  shadowTaps: number;
  ao: boolean;
  aoHalfRes: boolean;
  aoQuality: string;
  cloudSteps: number;
  cloudLightSteps: number;
  envSize: number;
  taa: boolean;
  bloomLevels: number;
  dofTaps: number;
  motionBlurSamples: number;
  sharpen: number;
  charShadow: number;
  ssr: boolean;
  ssrSteps?: number;
  shafts: boolean;
  shaftSteps: number;
  ssgi: boolean;
  ssgiDirs?: number;
  ssgiSteps?: number;
  wet: boolean;
  perf?: boolean;
  [key: string]: string | number | boolean | number[] | undefined;
};

type RendererCapabilitiesLike = {
  capabilities?: { maxTextures?: number };
};

const QUALITY_PRESETS: Record<QualityPresetName, QualitySettings> = {
  low: {
    name: "low",
    cascades: 2,
    shadowMapSize: 1024,
    shadowFar: 500,
    splits: [0.1, 30, 500],
    shadowTaps: 5,
    ao: false,
    aoHalfRes: true,
    aoQuality: "Performance",
    cloudSteps: 10,
    cloudLightSteps: 2,
    envSize: 64,
    taa: true,
    bloomLevels: 5,
    dofTaps: 16,
    motionBlurSamples: 6,
    sharpen: 0.25,
    charShadow: 0,
    ssr: false,
    shafts: false,
    shaftSteps: 0,
    ssgi: false,
    wet: false, // (lighting2 r1)
  },
  med: {
    name: "med",
    cascades: 3,
    shadowMapSize: 2048,
    shadowFar: 900,
    splits: [0.1, 18, 90, 900],
    shadowTaps: 8,
    ao: true,
    aoHalfRes: true,
    aoQuality: "Low",
    cloudSteps: 16,
    cloudLightSteps: 3,
    envSize: 128,
    taa: true,
    bloomLevels: 6,
    dofTaps: 22,
    motionBlurSamples: 8,
    sharpen: 0.3,
    charShadow: 1024,
    ssr: true,
    ssrSteps: 20,
    shafts: true,
    shaftSteps: 12,
    ssgi: true,
    ssgiDirs: 4,
    ssgiSteps: 4,
    wet: true, // (lighting2 r1)
  },
  high: {
    name: "high",
    // (foundation agent: a 5th, half-res cascade reaches 3 km so aerial views keep building / street-canyon shadows)
    cascades: 5,
    shadowMapSize: 2048,
    shadowFar: 3000,
    splits: [0.1, 14, 50, 200, 800, 3000],
    shadowTaps: 10,
    ao: true,
    aoHalfRes: false,
    aoQuality: "Medium",
    cloudSteps: 22,
    cloudLightSteps: 3,
    envSize: 128,
    taa: true,
    bloomLevels: 6,
    dofTaps: 43,
    motionBlurSamples: 10,
    sharpen: 0.35,
    charShadow: 2048,
    ssr: true,
    ssrSteps: 28,
    shafts: true,
    shaftSteps: 16,
    ssgi: true,
    ssgiDirs: 6,
    ssgiSteps: 4,
    wet: true, // (lighting2 r1) SSGI + wet-patch roughness
  },
};

let cachedQualitySettings: QualitySettings | null = null;
export function getQuality(
  renderer: RendererCapabilitiesLike | null = null,
): QualitySettings {
  if (cachedQualitySettings) return cachedQualitySettings;
  let name: QualityPresetName =
    renderer?.capabilities?.maxTextures != null &&
    renderer.capabilities.maxTextures <= 16
      ? "low"
      : "high";
  try {
    const requestedPresetParam = new URLSearchParams(location.search).get("q");
    const requestedPreset =
      requestedPresetParam === "medium" ? "med" : requestedPresetParam;
    if (
      requestedPreset === "low" ||
      requestedPreset === "med" ||
      requestedPreset === "high"
    ) {
      name = requestedPreset;
    }
  } catch (e) {
    /* non-browser */
  }
  cachedQualitySettings = { ...QUALITY_PRESETS[name] };
  // (perf) ?perfoff disables the perf agent's culling / batching changes (A/B measurements with tools/perf_probe.mjs)
  try {
    cachedQualitySettings.perf = !new URLSearchParams(location.search).has(
      "perfoff",
    );
  } catch (e) {
    cachedQualitySettings.perf = true;
  }
  // (perf r2) ?qset=ao:0,ssr:0,shadowMapSize:1024 overrides single preset fields (GPU ablation with tools/perf_probe.mjs)
  try {
    const qualityOverrides = new URLSearchParams(location.search).get("qset");
    if (qualityOverrides) {
      for (const override of qualityOverrides.split(",")) {
        const [settingName, settingValue] = override.split(":");
        if (settingName === undefined || settingValue === undefined) continue;
        if (!(settingName in cachedQualitySettings)) continue;

        const numericValue = Number(settingValue);
        const parsedValue =
          settingValue === "true"
            ? true
            : settingValue === "false"
              ? false
              : Number.isNaN(numericValue)
                ? settingValue
                : numericValue;
        cachedQualitySettings[settingName] = parsedValue;
      }
    }
  } catch (e) {
    /* non-browser */
  }
  return cachedQualitySettings;
}

// Retina displays can multiply the render targets' pixel count by 2.25 at 1.5x DPR.
// Keep 16-texture-unit GPUs at 80% resolution by default; renderScale remains a user multiplier.
export function getRenderPixelRatio(
  renderer: RendererCapabilitiesLike | null,
  renderScale = 1,
): number {
  const currentDevicePixelRatio =
    typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
  const maxTextures = renderer?.capabilities?.maxTextures;
  const maxRenderPixelRatio = maxTextures != null && maxTextures <= 16 ? 0.8 : 1.5;
  return Math.min(currentDevicePixelRatio, maxRenderPixelRatio) * renderScale;
}
