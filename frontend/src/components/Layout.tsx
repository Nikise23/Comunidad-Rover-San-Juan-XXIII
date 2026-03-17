import { useEffect, useState, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import Footer from './Footer';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Proyectos' },
  { to: '/beneficiaries', label: 'Protagonistas' },
  { to: '/events', label: 'Eventos' },
  { to: '/raffles', label: 'Rifas' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = window.localStorage.getItem('theme');
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  });
  const [accent, setAccent] = useState<'orange' | 'violet' | 'blue'>(() => {
    const stored = window.localStorage.getItem('accent');
    return stored === 'violet' || stored === 'blue' || stored === 'orange' ? stored : 'orange';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
    window.localStorage.setItem('accent', accent);
  }, [accent]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const cycleAccent = () => {
    setAccent((prev) => (prev === 'orange' ? 'violet' : prev === 'violet' ? 'blue' : 'orange'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="layout-header">
        <button
          type="button"
          className="layout-hamburger"
          aria-label="Abrir menú"
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </button>
        <span style={{ fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: '1rem', flex: 1 }}>
          Comunidad Rover San Juan XXIII
        </span>
        <button
          type="button"
          className="touch-target"
          onClick={toggleTheme}
          style={{
            padding: '0.3rem 0.7rem',
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--surface-hover)',
            color: 'var(--text)',
            fontSize: '0.8rem',
          }}
        >
          {theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
        </button>
        <button
          type="button"
          className="touch-target"
          onClick={cycleAccent}
          style={{
            marginLeft: 8,
            padding: '0.3rem 0.7rem',
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--surface-hover)',
            color: 'var(--text)',
            fontSize: '0.8rem',
          }}
        >
          Apariencia ({accent === 'orange' ? 'naranja' : accent === 'violet' ? 'violeta' : 'azul'})
        </button>
      </header>

      <div
        className="layout-overlay"
        data-open={menuOpen}
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside
          className="layout-sidebar"
          data-open={menuOpen}
          style={{
            width: 240,
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            padding: '1.5rem 0',
          }}
        >
          <div style={{ padding: '0 1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img src="/logo.png?v=2" alt="Comunidad Rover San Juan XXIII" style={{ width: 48, height: 48, objectFit: 'contain' }} />
              <div>
                <h1 style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)', lineHeight: 1.2, margin: 0 }}>
                  Comunidad Rover San Juan XXIII
                </h1>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, marginBottom: 0 }}>
                  Proyectos y recaudación
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, marginTop: 10 }}>
              <button
                type="button"
                onClick={toggleTheme}
                style={{
                  padding: '0.3rem 0.7rem',
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-hover)',
                  color: 'var(--text)',
                  fontSize: '0.8rem',
                }}
              >
                {theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
              </button>
              <button
                type="button"
                onClick={cycleAccent}
                style={{
                  padding: '0.3rem 0.7rem',
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-hover)',
                  color: 'var(--text)',
                  fontSize: '0.8rem',
                }}
              >
                Apariencia ({accent === 'orange' ? 'naranja' : accent === 'violet' ? 'violeta' : 'azul'})
              </button>
            </div>
          </div>
          <nav>
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setMenuOpen(false)}
                style={({ isActive }) => ({
                  display: 'block',
                  padding: '0.6rem 1.25rem',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: isActive ? 600 : 400,
                  borderLeft: `3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                  marginLeft: 0,
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="layout-main" style={{ flex: 1, padding: '1.5rem 2rem', overflow: 'auto' }}>
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
