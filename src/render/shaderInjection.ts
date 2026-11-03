/** Fill the compile-time values embedded in a raw GLSL source file. */
export function injectShader(template: string, ...values: unknown[]): string {
  let shader = template;
  for (let i = 0; i < values.length; i++) {
    shader = shader.replaceAll(`__SHADER_INJECT_${i}__`, String(values[i]));
  }
  return shader;
}
