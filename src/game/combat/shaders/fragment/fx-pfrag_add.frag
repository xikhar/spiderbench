
  uniform sampler2D uTex; in vec2 vUv; in vec4 vCol; out vec4 fragColor;
  void main(){ float m = texture(uTex, vUv).a; float a = m * vCol.a; if (a < 0.002) discard; fragColor = vec4(vCol.rgb * a, 1.0); }
