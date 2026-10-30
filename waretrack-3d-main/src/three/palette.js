
import * as THREE from 'three'

// DisruptionIQ light palette.
// Soft greys and white for the environment, with yellow brand accents.
export const C = {
  // Environment
  sky: 0xe9edf5,
  ground: 0xe9edf2,
  lot: 0xf0f2f6,
  sidewalk: 0xf8f9fb,
  curb: 0xd2d8e0,
  road: 0xd2d8e0,
  roadDark: 0xbfc7d2,
  roadLine: 0xffffff,
  grass: 0xe0eee3,
  grassGlow: 0xd3e8d8,
  yellowLine: 0xf5c542,

  // Brand / buildings
  // Keep the existing "blue" property names because other models use them.
  blue: 0xf5c542,
  blueDark: 0xc49a28,
  blueMid: 0xffd65e,
  blueLight: 0xffe59a,
  blueGlass: 0xb6c0d0,
  wall: 0xf5f7fa,
  wallShade: 0xe0e5ec,
  roofWhite: 0xffffff,
  doorFrame: 0xf5c542,
  doorInside: 0xc5ccd6,
  doorRoll: 0xd6dce5,

  // Vehicles
  white: 0xf7f8fc,
  black: 0x343943,
  tire: 0x2b2e37,
  hub: 0xc3c9d6,
  glassDark: 0x354052,
  forkYellow: 0xf5c542,
  forkBlue: 0xf5c542,
  skin: 0xc68a63,
  vestOrange: 0xe3a52d,
  navy: 0x667085,
  teal: 0x6caaa0,
  orange: 0xe8a044,
  container: 0x8bb8b0,

  // Cargo
  cardboard: 0xd9aa72,
  cardboardLight: 0xe6bf8c,
  cardboardDark: 0xc9965c,
  tape: 0xf0d6ac,
  wood: 0xd2a679,
  woodDark: 0xb98b5e,
  wrapBlue: 0xb8c4d8,
  wrapBlueLight: 0xd0d9e8,
  wrapWhite: 0xf1f3f8,

  // Props
  tree: 0x83c99b,
  treeDark: 0x62ae7e,
  trunk: 0x8a5a3b,
  fencePost: 0xc4cbd7,
  fencePanel: 0xe0e5ed,
  charger: 0xf4f6fa,
  chargerGlow: 0xf5c542,
  rackUpright: 0x9da8ba,
  rackBeam: 0xf5c542,
  cityWall: 0xf1f3f9,
  cityWindow: 0xb5c5e6,

  // Highlight / UI-in-3D
  select: 0xf5c542,
  selectGlow: 0xffdf70,
}

const cache = new Map()

/**
 * Cached MeshStandardMaterial.
 * Default: soft matte finish.
 */
export function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`

  if (!cache.has(key)) {
    cache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.78,
        metalness: 0,
        ...opts,
      }),
    )
  }

  return cache.get(key)
}

/** Transparent material helper for glass, fence panels, and glows. */
export function matTransparent(color, opacity, opts = {}) {
  return mat(color, {
    transparent: true,
    opacity,
    depthWrite: false,
    ...opts,
  })
}

/** Unlit material helper for ground decals and lines. */
export function matBasic(color, opts = {}) {
  const key = `basic|${color}|${JSON.stringify(opts)}`

  if (!cache.has(key)) {
    cache.set(
      key,
      new THREE.MeshBasicMaterial({
        color,
        ...opts,
      }),
    )
  }

  return cache.get(key)
}

/** Enable cast and receive shadows on every mesh of a subtree. */
export function shadows(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast
      o.receiveShadow = receive
    }
  })

  return obj
}
