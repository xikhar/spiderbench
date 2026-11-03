{ vec3 ic = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float fs = smoothstep(__SHADER_INJECT_0__, __SHADER_INJECT_1__, length(ic - cameraPosition)); transformed *= max(fs, 1e-3); }
