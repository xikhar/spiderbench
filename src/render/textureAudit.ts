type TextureUse = {
  texture: any;
  references: Set<string>;
};

const isPlainObject = (value: any) =>
  value !== null &&
  typeof value === "object" &&
  Object.getPrototypeOf(value) === Object.prototype;

function collectTextureValue(
  value: any,
  path: string,
  add: (texture: any, path: string) => void,
  seen = new Set<any>(),
  depth = 0,
) {
  if (!value || depth > 5) return;
  if (value.isTexture) {
    add(value, path);
    return;
  }
  if (typeof value !== "object" || seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      collectTextureValue(entry, `${path}[${index}]`, add, seen, depth + 1),
    );
  } else if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      collectTextureValue(entry, `${path}.${key}`, add, seen, depth + 1);
    }
  }
}

function objectLabel(object: any) {
  return `${object.type || object.constructor?.name || "Object"}#${object.name || object.id}`;
}

function textureDimensions(texture: any) {
  const image = texture.image ?? texture.source?.data;
  const source = Array.isArray(image) ? image.find(Boolean) : image;
  const mip = texture.mipmaps?.[0];
  const target = texture.renderTarget;
  const width =
    source?.width ||
    source?.videoWidth ||
    source?.naturalWidth ||
    mip?.width ||
    target?.width ||
    0;
  const height =
    source?.height ||
    source?.videoHeight ||
    source?.naturalHeight ||
    mip?.height ||
    target?.height ||
    0;
  return { width, height };
}

/** Reports source validity and the WebGL upload state of scene material textures. */
export function auditSceneTextures(renderer: any, scene: any) {
  const uses = new Map<any, TextureUse>();
  const add = (texture: any, reference: string) => {
    let use = uses.get(texture);
    if (!use) {
      use = { texture, references: new Set() };
      uses.set(texture, use);
    }
    use.references.add(reference);
  };

  if (scene.background?.isTexture) add(scene.background, "scene.background");
  if (scene.environment?.isTexture) add(scene.environment, "scene.environment");

  scene.traverse((object: any) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) {
      const owner = `${objectLabel(object)} / ${material.name || material.type}`;
      for (const [key, value] of Object.entries(material)) {
        if (key === "uniforms") continue;
        collectTextureValue(value, `${owner}.${key}`, add);
      }
      for (const [key, uniform] of Object.entries(material.uniforms ?? {})) {
        collectTextureValue(
          (uniform as any)?.value,
          `${owner}.uniforms.${key}`,
          add,
        );
      }
    }
  });

  const rows: Array<Record<string, any>> = [];
  const invalidSources = [];
  const notUploaded = [];
  let uploaded = 0;
  let renderTargets = 0;
  let readyRenderTargets = 0;

  for (const { texture, references } of uses.values()) {
    const { width, height } = textureDimensions(texture);
    const isRenderTarget = Boolean(texture.isRenderTargetTexture);
    const validSource = isRenderTarget || (width > 0 && height > 0);
    const props = renderer.properties?.get?.(texture);
    const hasGpuHandle = Boolean(props?.__webglTexture);
    const gpuUploaded =
      !isRenderTarget && hasGpuHandle && props.__version === texture.version;
    const renderTargetReady = isRenderTarget && hasGpuHandle;
    const name =
      texture.name ||
      `${texture.constructor?.name || "Texture"} ${texture.uuid?.slice(0, 8) || ""}`;
    const status = !validSource
      ? "INVALID SOURCE"
      : gpuUploaded
        ? "GPU UPLOADED"
        : isRenderTarget
          ? renderTargetReady
            ? "RENDER TARGET READY"
            : "RENDER TARGET NOT INITIALIZED"
          : "NOT GPU UPLOADED (not sampled yet)";

    if (!validSource) invalidSources.push({ name, references: [...references] });
    if (validSource && !gpuUploaded && !isRenderTarget) {
      notUploaded.push({ name, references: [...references] });
    }
    if (gpuUploaded) uploaded++;
    if (isRenderTarget) renderTargets++;
    if (renderTargetReady) readyRenderTargets++;

    rows.push({
      texture: name,
      source: width > 0 && height > 0 ? `${width}x${height}` : "missing dimensions",
      status,
      references: [...references].slice(0, 3).join("; "),
      moreReferences: Math.max(0, references.size - 3),
    });
  }

  const summary = {
    textures: uses.size,
    uploaded,
    notUploaded: notUploaded.length,
    invalidSources: invalidSources.length,
    renderTargets,
    readyRenderTargets,
    rendererTextureCount: renderer.info?.memory?.textures,
  };
  const title = invalidSources.length
    ? `[texture-audit] ISSUES FOUND: ${invalidSources.length} texture source(s) invalid`
    : `[texture-audit] ${uses.size} scene texture(s) checked`;

  console.groupCollapsed(title);
  console.info("Summary:", summary);
  if (invalidSources.length) {
    for (const issue of invalidSources) {
      console.error("Texture has no valid image dimensions:", issue);
    }
  }
  if (notUploaded.length) {
    console.warn(
      `${notUploaded.length} referenced texture(s) have not been uploaded to the GPU yet. They may belong to objects outside the current view; run window.auditSceneTextures() again after viewing them.`,
      notUploaded,
    );
  }
  if (rows.length) console.table(rows);
  else console.warn("No textures are currently referenced by scene materials.");
  console.groupEnd();

  return summary;
}
