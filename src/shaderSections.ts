/**
 * Reads named chunks from a combined GLSL file.
 *
 * Chunks are marked with `// @section name` lines. The marker stays outside
 * the shader text passed to Three.js.
 */
export function parseShaderSections(source: string): Record<string, string> {
  if (typeof source !== "string") {
    throw new TypeError(
      "Shader source is missing; check that the GLSL ?raw import resolves to a string.",
    );
  }

  const markers = [...source.matchAll(/^\/\/ @section ([A-Za-z][A-Za-z0-9_]*)\r?$/gm)];
  const sections: Record<string, string> = Object.create(null);

  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    if (!marker || marker.index === undefined) {
      throw new Error("Invalid GLSL section marker.");
    }

    const markerText = marker[0];
    const name = marker[1];
    if (!markerText || !name || Object.hasOwn(sections, name)) {
      throw new Error(`Duplicate or invalid GLSL section name: ${name ?? "<empty>"}`);
    }

    const contentStart = marker.index + markerText.length;
    const nextMarker = markers[index + 1];
    const contentEnd = nextMarker?.index ?? source.length;
    const chunk = source.slice(contentStart, contentEnd).replace(/^\r?\n/, "");
    sections[name] = chunk;
  }

  if (markers.length === 0) {
    throw new Error("Combined GLSL file has no `// @section name` markers.");
  }

  return sections;
}

/** Parse a shader only when its first section is requested. */
export function lazyShaderSections<SectionName extends string = string>(
  getSource: () => string,
): Record<SectionName, string> {
  let sections: Record<string, string> | undefined;

  return new Proxy(Object.create(null) as Record<SectionName, string>, {
    get(target, property, receiver) {
      if (typeof property !== "string") {
        return Reflect.get(target, property, receiver);
      }

      sections ??= parseShaderSections(getSource());
      return sections[property];
    },
  });
}
