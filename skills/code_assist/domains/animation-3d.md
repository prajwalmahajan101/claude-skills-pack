---
name: code_assist/domains/animation-3d
description: Condensed animation + 3D/WebGL playbook - GSAP/ScrollTrigger, Motion, Three.js/R3F, performance budget. Self-contained.
type: skill
---

# Domain - Animation & 3D / WebGL

## Library choice
- **GSAP + ScrollTrigger** - scroll-driven timelines, pin/scrub/parallax, complex sequencing.
- **Motion (Framer Motion)** - React component animation, gestures, drag, layout/spring.
- **Three.js / React Three Fiber (R3F)** - 3D scenes; R3F for declarative React 3D.
- **Lottie** - designer-authored vector animations (After Effects JSON).
- Don't stack redundant libraries; pick per need and integrate deliberately.

## Principles
- Animate `transform`/`opacity` (GPU-composited); avoid animating layout properties.
- Respect `prefers-reduced-motion`. Clean up timelines/listeners on unmount (React effects).
- ScrollTrigger: set proper `start`/`end`, use `scrub` for scroll-linked, refresh on resize.
- R3F: reuse geometries/materials, dispose on unmount, throttle `useFrame` work, keep draw
  calls low; lazy-load heavy assets; cap devicePixelRatio.

## Performance budget
- Hold 60fps; profile with the browser performance panel. Budget the main thread; move heavy
  work off it. Test on a mid-tier device, not just a workstation.

## Deeper references (optional, if installed)
`gsap-scrolltrigger`, `motion`, `lottie-animations`, `locomotive-scroll`, `react-three-fiber`
+ `r3f-*`, `threejs-webgl`, `webgpu-threejs-tsl`, `web3d-integration-patterns`.
