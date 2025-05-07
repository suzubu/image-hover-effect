// Pass UV coordinates to fragment shader
export const vertexShader = `
varying vec2 v_uv;

void main() {
    v_uv = uv;
    gl_Position = vec4(position, 1.0); // screen-aligned quad
}`;

export const fragmentShader = `   precision highp float;

// === [ Uniform Inputs ] ===
uniform sampler2D u_texture;           // Image texture
uniform vec2 u_mouse;                  // Mouse position (normalized 0–1)
uniform float u_time;                  // Elapsed time
uniform vec2 u_resolution;            // Canvas width & height
uniform float u_radius;               // Radius of lens
uniform float u_speed;                // Time speed multiplier for turbulence
uniform float u_imageAspect;          // Aspect ratio of loaded image
uniform float u_turbulenceIntensity;  // Scale of turbulence at edge

varying vec2 v_uv;

// === [ Noise Functions for Turbulence ] ===
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

float turbulence(vec2 p) {
    float t = 0.0;
    float w = 0.5;
    for(int i = 0; i < 8; i++) {
        t += abs(noise(p)) * w;
        p *= 2.0;
        w *= 0.5;
    }
    return t;
}

// === [ Main Shader Logic ] ===
void main() {
    vec2 uv = v_uv;

    // Correct for screen-to-image aspect ratio
    float screenAspect = u_resolution.x / u_resolution.y;
    float ratio = u_imageAspect / screenAspect;
    vec2 texCoord = vec2(mix(0.5 - 0.5/ratio, 0.5 + 0.5/ratio, uv.x), uv.y);

    // Sample the original image
    vec4 tex = texture2D(u_texture, texCoord);

    // Convert image to grayscale
    float gray = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
    vec3 invertedGray = vec3(1.0 - gray);

    // Adjust coordinates for radial distance calculation
    vec2 correctedUV = uv;
    correctedUV.x *= screenAspect;
    vec2 correctMouse = u_mouse;
    correctMouse.x *= screenAspect;

    // Distance from cursor to pixel (adjusted)
    float dist = distance(correctedUV, correctMouse);

    // Add noise-driven turbulence to the lens edge
    float jaggedDist = dist + (turbulence(uv * 25.0 + u_time * u_speed) - 0.5) * u_turbulenceIntensity;

    // Binary mask: inside = 1.0, outside = 0.0
    float mask = step(jaggedDist, u_radius);

    // Blend grayscale inversion with original texture
    vec3 finalColor = mix(invertedGray, tex.rgb, 1.0 - mask);
    gl_FragColor = vec4(finalColor, 1.0);
}`;
