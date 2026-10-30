
import './intro.css'

const params = new URLSearchParams(window.location.search)

if (params.get('workspace') === 'true') {
  document.querySelector('.intro-overlay')?.remove()
}

const getStarted = document.querySelector('#get-started')

getStarted?.addEventListener('click', () => {
  window.location.href = '/src/role-selection.html'
})
