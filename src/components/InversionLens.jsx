"use client";

import { useEffect, useRef } from "react";
import { vertexShader, fragmentShader } from "./shaders";
import * as THREE from "three";

const InversionLens = ({ src, className }) => {
  // Main container ref for the WebGL canvas
  const containerRef = useRef(null);

  // Refs for Three.js scene elements and shader uniforms
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const uniformsRef = useRef(null);

  // Flag to track setup completion
  const isSetupCompleteRef = useRef(false);

  // Configurable values for lens behavior and animation
  const config = {
    maskRadius: 0.15, // Default lens radius when active
    maskSpeed: 0.75, // Speed of lens turbulence animation
    lerpFactor: 0.05, // Smooth transition factor for mouse movement
    radiusLerpSpeed: 0.1, // Smooth transition factor for lens radius
    turbulenceIntensity: 0.075, // Jagged edge turbulence amount
  };

  // Mouse-related refs
  const targetMouse = useRef(new THREE.Vector2(0.5, 0.5)); // Actual mouse position
  const lerpedMouse = useRef(new THREE.Vector2(0.5, 0.5)); // Interpolated mouse position for smoothing
  const targetRadius = useRef(0.0); // Target lens radius
  const isInView = useRef(false); // Whether component is in viewport
  const isMouseInsideContainer = useRef(false); // Whether mouse is inside bounds
  const lastMouseX = useRef(0); // Last mouse X position
  const lastMouseY = useRef(0); // Last mouse Y position
  const animationFrameId = useRef(null); // ID for canceling animation frame

  useEffect(() => {
    if (!containerRef.current || !src) return;

    const loader = new THREE.TextureLoader();
    loader.load(src, (texture) => {
      console.log("Texture loaded", texture.image.width, texture.image.height);
      setupScene(texture);
      setupEventListeners();
      animate();
      isSetupCompleteRef.current = true;
    });

    // Cleanup on component unmount
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();

        if (containerRef.current) {
          const canvas = containerRef.current.querySelector("canvas");
          if (canvas) {
            containerRef.current.removeChild(canvas);
          }
        }
      }
    };
  }, [src]);

  const setupScene = (texture) => {
    if (!containerRef.current) return;

    const imageAspect = texture.image.width / texture.image.height;
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotrophy = 16;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cameraRef.current = camera;

    const uniforms = {
      u_texture: { value: texture },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_radius: { value: 0.0 },
      u_speed: { value: config.maskSpeed },
      u_imageAspect: { value: imageAspect },
      u_turbulenceIntensity: { value: config.turbulenceIntensity },
    };
    uniformsRef.current = uniforms;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.capabilities.anisotrophy = 16;

    containerRef.current.appendChild(renderer.domElement);

    // Resize listener to update render size and resolution uniform
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !uniformsRef.current)
        return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      rendererRef.current.setSize(width, height);
      uniformsRef.current.u_resolution.value.set(width, height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  };

  const setupEventListeners = () => {
    const handleMouseMove = (e) => {
      updateCursorState(e.clientX, e.clientY);
    };

    const handleScroll = () => {
      updateCursorState(lastMouseX.current, lastMouseY.current);
    };

    document.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);

    // Observer to check if component is in view
    let observer;
    if (containerRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            isInView.current = entry.isIntersecting;
            if (!isInView.current) {
              targetRadius.current = 0.0;
            }
          });
        },
        { threshold: 0.1 }
      );

      observer.observe(containerRef.current);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
      if (observer) observer.disconnect();
    };
  };

  const updateCursorState = (x, y) => {
    if (!containerRef.current) return;
    lastMouseX.current = x;
    lastMouseY.current = y;

    const rect = containerRef.current.getBoundingClientRect();
    const inside =
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

    isMouseInsideContainer.current = inside;

    if (inside) {
      // Normalize mouse position to local container space
      targetMouse.current.x = (x - rect.left) / rect.width;
      targetMouse.current.y = 1.0 - (y - rect.top) / rect.height;
      targetRadius.current = config.maskRadius;
    } else {
      targetRadius.current = 0;
    }
  };

  const animate = () => {
    if (
      !uniformsRef.current ||
      !rendererRef.current ||
      !sceneRef.current ||
      !cameraRef.current
    ) {
      animationFrameId.current = requestAnimationFrame(animate);
      return;
    }

    // Smoothly interpolate mouse position
    lerpedMouse.current.lerp(targetMouse.current, config.lerpFactor);

    uniformsRef.current.u_mouse.value.copy(lerpedMouse.current);
    uniformsRef.current.u_time.value += 0.01;
    uniformsRef.current.u_radius.value +=
      (targetRadius.current - uniformsRef.current.u_radius.value) *
      config.radiusLerpSpeed;

    rendererRef.current.render(sceneRef.current, cameraRef.current);

    animationFrameId.current = requestAnimationFrame(animate);
  };

  return (
    <div ref={containerRef} className={`inversion-lens ${className || ""}`}>
      <img src={src} style={{ display: "none" }} />
    </div>
  );
};

export default InversionLens;
