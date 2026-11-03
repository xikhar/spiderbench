in vec4 iP;
in vec4 iS;
in vec4 iA;

uniform sampler2D uAnim;
uniform float uTime;
uniform vec3 uHip;
uniform vec3 uFL;
uniform vec3 uFR;

out vec2 vShadowCoordinates;
out float vOpacity;
out float vShadowPart;

mat4 fetchBoneMatrix(int animationRow, int boneIndex) {
  ivec2 texelCoordinate = ivec2(boneIndex * 3, animationRow);
  vec4 firstColumn = texelFetch(uAnim, texelCoordinate, 0);
  vec4 secondColumn = texelFetch(uAnim, texelCoordinate + ivec2(1, 0), 0);
  vec4 thirdColumn = texelFetch(uAnim, texelCoordinate + ivec2(2, 0), 0);

  return mat4(firstColumn.x, secondColumn.x, thirdColumn.x, 0.0, firstColumn.y, secondColumn.y, thirdColumn.y, 0.0, firstColumn.z, secondColumn.z, thirdColumn.z, 0.0, firstColumn.w, secondColumn.w, thirdColumn.w, 1.0);
}

void main() {
  int shadowPart = int(position.z + 0.5);
  float animationFrame = mod((uTime - iA.w) * iA.z * 30.0, iA.y);
  if(animationFrame < 0.0)
    animationFrame += iA.y;

  int previousFrame = int(floor(animationFrame));
  int nextFrame = previousFrame + 1;
  if(float(nextFrame) >= iA.y)
    nextFrame = 0;
  float frameBlend = fract(animationFrame);

  int boneIndex = shadowPart == 0 ? 0 : shadowPart == 1 ? 13 : 16;
  vec3 jointPosition = shadowPart == 0 ? uHip : shadowPart == 1 ? uFL : uFR;
  int animationRow = int(iA.x + 0.5);
  vec3 worldJointPosition = ((fetchBoneMatrix(animationRow + previousFrame, boneIndex) *
    (1.0 - frameBlend) +
    fetchBoneMatrix(animationRow + nextFrame, boneIndex) * frameBlend) *
    vec4(jointPosition, 1.0)).xyz;

  float jointHeight = shadowPart == 0 ? 0.0 : max(0.0, worldJointPosition.y - uFL.y);
  vec2 shadowRadius = shadowPart == 0 ? vec2(0.36, 0.32) : vec2(0.085, 0.17) * (1.0 + jointHeight * 2.5);
  vec2 localShadowPosition = (shadowPart == 0 ? worldJointPosition.xz * 0.5 : worldJointPosition.xz + vec2(0.0, 0.045)) + position.xy * shadowRadius;

  float rotationCosine = cos(iP.w);
  float rotationSine = sin(iP.w);
  vec2 rotatedShadowPosition = vec2(rotationCosine * localShadowPosition.x * iS.y +
    rotationSine * localShadowPosition.y, -rotationSine * localShadowPosition.x * iS.y +
    rotationCosine * localShadowPosition.y) * iS.x;

  vShadowCoordinates = position.xy;
  // Feet use a tight, strong contact shadow; the hip uses a wider, softer halo.
  vOpacity = (shadowPart == 0 ? 0.72 : 0.95 * (1.0 - smoothstep(0.03, 0.18, jointHeight))) * iS.z;
  vShadowPart = float(shadowPart);

  gl_Position = projectionMatrix * viewMatrix * vec4(iP.x + rotatedShadowPosition.x, iP.y + 0.015, iP.z + rotatedShadowPosition.y, 1.0);
}
