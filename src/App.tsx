import { useCallback, useEffect, useState } from 'react'
import { CraftSpace } from './components/CraftSpace'
import { LandingPage } from './components/LandingPage'

function readHashRoute(): 'landing' | 'craft' {
  const raw = window.location.hash.replace(/^#/, '')
  if (/^\/?craft(\/|$)/.test(raw)) return 'craft'
  return 'landing'
}

export default function App() {
  const [route, setRoute] = useState<'landing' | 'craft'>(readHashRoute)

  useEffect(() => {
    const onHashChange = () => setRoute(readHashRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const goCraft = useCallback(() => {
    window.location.hash = '/craft'
  }, [])

  return (
    <main data-route={route}>
      {route === 'craft' ? (
        <CraftSpace />
      ) : (
        <LandingPage onCreateYourOwn={goCraft} />
      )}
    </main>
  )
}
