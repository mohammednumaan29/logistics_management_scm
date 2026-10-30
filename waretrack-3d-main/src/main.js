
 // App bootstrap — wires the 3D scene, world, simulation, camera director, interaction and UI.
 // Contracts for every module are in docs/SPEC.md.

import './ui/styles.css'
import { createScene } from './three/scene.js'
import { createWorld } from './three/world.js'
import { createInteraction } from './three/interaction.js'
import { createCameraDirector } from './three/cameraDirector.js'
import { createSimulation } from './state/simulation.js'
import { mountUI } from './ui/index.js'
import { store } from './state/store.js'
import { db } from './data/db.js'
import { createIntroTour } from './three/introTour.js'

const requestedRole = new URLSearchParams(location.search).get('role')

if (requestedRole === 'Operations Analyst') {
  window.location.replace('/src/operations-analyst.html')
} else if (requestedRole === 'Inventory Manager') {
  window.location.replace('/src/inventory-manager.html')
} else if (requestedRole === 'Logistics & Transportation Manager') {
  window.location.replace('/src/logistics-manager.html')
} else {
  const app = createScene(document.getElementById('viewport'))
  const world = createWorld(app)
  const sim = createSimulation(world)
  const director = createCameraDirector(app, world)
  const introTour = createIntroTour(app, world)

  window.__disruptionIQTour = introTour

  const interaction = createInteraction(app, world)
  mountUI(document.getElementById('ui'))

  app.onFrame((dt, elapsed) => {
    sim.update(dt, elapsed)
    world.update(dt, elapsed)
    interaction.update(dt, elapsed)
    director.update(dt, elapsed)
  })

  app.start()

  const params = new URLSearchParams(location.search)
  applyDeepLink(params)

  /** Shareable links: ?site=WH-04&select=truck:TRK-2205&tab=trucks */
  function applyDeepLink(params) {
    const site = params.get('site')

    if (site && (site === 'ALL' || db.site(site))) {
      store.setSite(site)
    }

    const tab = params.get('tab')

    if (['docks', 'forklifts', 'trucks'].includes(tab)) {
      store.set({ fleetTab: tab })
    }

    const [type, id] = (params.get('select') ?? '').split(':')

    if (type && id && db.get(type, id)) {
      store.select({ type, id })
    }
  }

  // Handy for debugging in the console
  window.__waretrack = { app, world, sim, director, interaction }

  window.addEventListener('disruptioniq:start-tour', () => {
    introTour.start()
  })

  window.addEventListener('disruptioniq:stop-tour', () => {
    introTour.stop()
  })

  window.addEventListener('disruptioniq:go-to-stop', (event) => {
    introTour.goToStop(event.detail.index)
  })
}
