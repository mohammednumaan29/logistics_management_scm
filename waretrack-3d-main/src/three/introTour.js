
import { siteLayout } from '../data/layout.js'

const STOPS = [
  { id: 'WH-01', title: 'Detect', distance: 87 },
  { id: 'WH-02', title: 'Investigate', distance: 116 },
  { id: 'WH-03', title: 'Simulate', distance: 135 },
  { id: 'WH-04', title: 'Decide', distance: 105 },
  { id: 'WH-05', title: 'Recover', distance: 125 },
]

export function createIntroTour(app, world) {
  const overlay = document.querySelector('#intro-overlay')
  let currentStop = -1
  let scrollFrame = 0

  function goToStop(index) {
    const stopIndex = Math.max(0, Math.min(STOPS.length - 1, index))
    if (stopIndex === currentStop) return

    const stop = STOPS[stopIndex]
    const layout = siteLayout(stop.id)
    const view = world.getSiteView(stop.id)

    if (!view) return

    currentStop = stopIndex

    app.flyTo({
      ...view,
      target: {
        x: layout.view.target.x,
        y: layout.view.target.y ?? 0,
        z: layout.view.target.z,
      },
      distance: stop.distance,
      duration: 1.2,
      arc: true,
    })

    window.dispatchEvent(
      new CustomEvent('disruptioniq:tour-stop', {
        detail: { ...stop, index: stopIndex },
      }),
    )
  }

  function onScroll() {
    if (scrollFrame) cancelAnimationFrame(scrollFrame)

    scrollFrame = requestAnimationFrame(() => {
      if (!overlay) return

      const maxScroll = overlay.scrollHeight - overlay.clientHeight
      if (maxScroll <= 0) return

      const progress = overlay.scrollTop / maxScroll
      const index = Math.round(progress * (STOPS.length - 1))

      goToStop(index)
      scrollFrame = 0
    })
  }

  function start() {
    goToStop(0)
  }

  function stop() {
    if (scrollFrame) cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }

  overlay?.addEventListener('scroll', onScroll, { passive: true })

  return {
    start,
    stop,
    goToStop,
    dispose() {
      stop()
      overlay?.removeEventListener('scroll', onScroll)
    },
  }
}
