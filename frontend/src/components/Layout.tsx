import { useEffect, useState, ReactNode, FormEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Footer from './Footer';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Proyectos' },
  { to: '/beneficiaries', label: 'Protagonistas' },
  { to: '/events', label: 'Eventos' },
  { to: '/raffles', label: 'Rifas' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout, setSession } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [acctBusy, setAcctBusy] = useState(false);
  const [acctMsg, setAcctMsg] = useState<string | null>(null);
  const [acctErr, setAcctErr] = useState<string | null>(null);
  const [pwCur, setPwCur] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwNew2, setPwNew2] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [userPwConfirm, setUserPwConfirm] = useState('');
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

  const openAccount = () => {
    setAccountOpen(true);
    setAcctMsg(null);
    setAcctErr(null);
    setPwCur('');
    setPwNew('');
    setPwNew2('');
    setNewUsername(user?.username || '');
    setUserPwConfirm('');
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setAcctMsg(null);
    setAcctErr(null);
    if (pwNew.length < 8) {
      setAcctErr('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (pwNew !== pwNew2) {
      setAcctErr('Las contraseñas nuevas no coinciden.');
      return;
    }
    setAcctBusy(true);
    try {
      await authApi.changePassword(pwCur, pwNew);
      setAcctMsg('Contraseña actualizada.');
      setPwCur('');
      setPwNew('');
      setPwNew2('');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setAcctErr(ax.response?.data?.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setAcctBusy(false);
    }
  };

  const submitUsername = async (e: FormEvent) => {
    e.preventDefault();
    setAcctMsg(null);
    setAcctErr(null);
    const nu = newUsername.trim().toLowerCase();
    if (nu.length < 3) {
      setAcctErr('El usuario debe tener al menos 3 caracteres.');
      return;
    }
    setAcctBusy(true);
    try {
      const { data } = await authApi.changeUsername(nu, userPwConfirm);
      setSession(data.access_token, data.user);
      setAcctMsg('Usuario actualizado.');
      setUserPwConfirm('');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setAcctErr(ax.response?.data?.message || 'No se pudo cambiar el usuario.');
    } finally {
      setAcctBusy(false);
    }
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
        {user ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 8, maxWidth: 120 }} title={user.username}>
            {user.username}
          </span>
        ) : null}
        <button
          type="button"
          className="touch-target"
          onClick={logout}
          style={{
            marginRight: 8,
            padding: '0.3rem 0.6rem',
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--surface-hover)',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
          }}
        >
          Salir
        </button>
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
            padding: '1.5rem 0 0',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
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
          <nav style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
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
          {user ? (
            <div
              style={{
                padding: '0.75rem 1.25rem 1.25rem',
                borderTop: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, wordBreak: 'break-all' }}>
                Sesión: <strong style={{ color: 'var(--text)' }}>{user.username}</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                <button
                  type="button"
                  onClick={openAccount}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-hover)',
                    color: 'var(--text)',
                    fontSize: '0.8rem',
                  }}
                >
                  Mi cuenta
                </button>
                <button
                  type="button"
                  onClick={() => { logout(); setMenuOpen(false); }}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: 8,
                    border: '1px solid var(--accent)',
                    background: 'transparent',
                    color: 'var(--accent)',
                    fontSize: '0.8rem',
                  }}
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          ) : null}
        </aside>
        <main className="layout-main" style={{ flex: 1, padding: '1.5rem 2rem', overflow: 'auto' }}>
          {children}
        </main>
      </div>
      <Footer />

      {accountOpen ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => !acctBusy && setAccountOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '1.25rem 1.35rem',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
            }}
          >
            <h2 id="account-title" style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', marginBottom: 12 }}>
              Mi cuenta
            </h2>
            {acctMsg ? <p style={{ color: 'var(--success)', fontSize: '0.9rem', marginBottom: 10 }}>{acctMsg}</p> : null}
            {acctErr ? <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: 10 }}>{acctErr}</p> : null}

            <h3 style={{ fontSize: '0.95rem', margin: '0.75rem 0 0.5rem' }}>Cambiar contraseña</h3>
            <form onSubmit={submitPassword} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="password"
                placeholder="Contraseña actual"
                value={pwCur}
                onChange={(e) => setPwCur(e.target.value)}
                required
                style={{ padding: '0.6rem 0.75rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
              <input
                type="password"
                placeholder="Nueva contraseña (mín. 8)"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                required
                minLength={8}
                style={{ padding: '0.6rem 0.75rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
              <input
                type="password"
                placeholder="Repetir nueva contraseña"
                value={pwNew2}
                onChange={(e) => setPwNew2(e.target.value)}
                required
                minLength={8}
                style={{ padding: '0.6rem 0.75rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
              <button
                type="submit"
                disabled={acctBusy}
                style={{
                  marginTop: 4,
                  padding: '0.65rem',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: acctBusy ? 'wait' : 'pointer',
                  opacity: acctBusy ? 0.7 : 1,
                }}
              >
                Guardar contraseña
              </button>
            </form>

            <h3 style={{ fontSize: '0.95rem', margin: '1.25rem 0 0.5rem' }}>Cambiar usuario</h3>
            <form onSubmit={submitUsername} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                placeholder="Nuevo usuario"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
                minLength={3}
                style={{ padding: '0.6rem 0.75rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
              <input
                type="password"
                placeholder="Contraseña actual (confirmación)"
                value={userPwConfirm}
                onChange={(e) => setUserPwConfirm(e.target.value)}
                required
                style={{ padding: '0.6rem 0.75rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
              <button
                type="submit"
                disabled={acctBusy}
                style={{
                  marginTop: 4,
                  padding: '0.65rem',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-hover)',
                  color: 'var(--text)',
                  fontWeight: 600,
                  cursor: acctBusy ? 'wait' : 'pointer',
                  opacity: acctBusy ? 0.7 : 1,
                }}
              >
                Guardar usuario
              </button>
            </form>

            <button
              type="button"
              disabled={acctBusy}
              onClick={() => setAccountOpen(false)}
              style={{
                marginTop: 14,
                width: '100%',
                padding: '0.5rem',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
