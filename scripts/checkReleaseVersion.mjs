export function assertVersionMatch(manifestVersion, packageVersion) {
  if (manifestVersion !== packageVersion) {
    throw new Error(
      `Version mismatch: dist/manifest.json (${manifestVersion}) does not match package.json (${packageVersion}). ` +
        "Update public/manifest.json and package.json to the same version before packaging.",
    );
  }
}
