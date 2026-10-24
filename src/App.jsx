import { useEffect, useState } from 'react';
import Landing from './components/Landing.jsx';
import Student from './components/Student.jsx';
import Host from './components/Host.jsx';
import Viewer from './components/Viewer.jsx';
import Diagramas from './components/Diagramas.jsx';

const route = () => (location.hash.split('?')[0] || '#/').replace(/^#/, '') || '/';

export default function App() {
  const [r, setR] = useState(route());
  useEffect(() => {
    const on = () => setR(route());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return (
    <>
      {r !== '/profesor' && (
        <header className="topbar">
          <a className="logo" href="#/"><i aria-hidden="true" />PixPro Arena</a>
          <nav><a href="#/sala" aria-current={r === '/sala' ? 'page' : undefined}>Estudiante</a><a href="#/diapositivas" aria-current={r === '/diapositivas' ? 'page' : undefined}>Repasar</a><a href="#/diagramas" aria-current={r === '/diagramas' ? 'page' : undefined}>Diagramas</a><a href="#/profesor">Profesor</a></nav>
        </header>
      )}
      {r === '/sala' ? <Student /> : r === '/profesor' ? <Host /> : r === '/diapositivas' ? <Viewer /> : r === '/diagramas' ? <Diagramas /> : <Landing />}
    </>
  );
}
