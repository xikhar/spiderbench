const performanceFlags =
  typeof location !== "undefined"
    ? new URLSearchParams(location.search)
    : new URLSearchParams();

// `perf2off` disables all performance changes; individual flags disable one change at a time.
export function isPerformanceFeatureDisabled(featureName: string): boolean {
  return performanceFlags.has("perf2off") || performanceFlags.has(featureName);
}
