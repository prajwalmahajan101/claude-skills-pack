---
name: code_assist/domains/web3d
description: Condensed multi-library web-3D integration playbook - combining Three.js/R3F with GSAP/Motion and scroll, architecture + performance. Self-contained. Complements domains/animation-3d.md.
type: skill
---

# Domain - Web 3D Integration

For single-library work see `domains/animation-3d.md`. This is about combining them.

## Architecture
- One source of truth for the render loop. In R3F, drive animation inside `useFrame`; do not run
  a competing rAF loop. Bridge GSAP timelines to R3F via a shared clock/state, not duplicate loops.
- Keep 3D state in a store (zustand) separate from React tree churn; mutate objects imperatively
  in the frame loop, not via React re-renders.
- Scroll-driven 3D: ScrollTrigger (or Lenis/Locomotive) provides scroll progress; map it to
  camera/material uniforms. Decouple scroll input from the render loop.

## Performance
- Budget the frame: minimize draw calls (instancing, merged geometry), reuse materials/geometries,
  dispose on unmount. Cap devicePixelRatio; lazy-load heavy GLTF/textures; use Draco/KTX2.
- Prefer transform/opacity for DOM overlays; keep the main thread free (offload to workers/GPU).
- Test on a mid-tier device; hold 60fps; profile before optimizing.

## WebGPU / TSL
- Migrate to the WebGPU renderer + TSL node materials for compute-heavy scenes; feature-detect
  and fall back to WebGL.

## Deeper references (optional)
`web3d-integration-patterns`, `react-three-fiber` + `r3f-*`, `threejs-webgl`,
`webgpu-threejs-tsl`, `gsap-scrolltrigger`, `motion`, `locomotive-scroll`.
