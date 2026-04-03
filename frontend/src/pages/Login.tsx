import { FormEvent, useState } from 'react';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import './Login.css';

type Mode = 'signin' | 'signup';

/**
 * Pantalla de acceso sugerida: panel azul + formularios que alternan (inspirado en UI de referencia).
 */
export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [signInUser, setSignInUser] = useState('');
  const [signInPass, setSignInPass] = useState('');

  const [signUpName, setSignUpName] = useState('');
  const [signUpUser, setSignUpUser] = useState('');
  const [signUpPass, setSignUpPass] = useState('');

  const onSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(signInUser.trim(), signInPass);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message as string | undefined)
          : undefined;
      setError(msg || 'No se pudo iniciar sesión. Revisá usuario y contraseña.');
    } finally {
      setBusy(false);
    }
  };

  const onSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (signUpPass.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setBusy(true);
    try {
      await register(signUpUser.trim(), signUpPass, signUpName.trim() || undefined);
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: { message?: string | string[] } };
      };
      const raw = ax.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(', ') : raw;
      if (ax.response?.status === 403) {
        setError('El registro público está desactivado. Usá la cuenta que te dio el grupo o pedí acceso.');
      } else {
        setError(typeof msg === 'string' ? msg : 'No se pudo crear la cuenta.');
      }
    } finally {
      setBusy(false);
    }
  };

  const heroTitle = mode === 'signin' ? '¿Primera vez acá?' : 'Bienvenido de nuevo';
  const heroText =
    mode === 'signin'
      ? 'Si ya tenés usuario y contraseña otorgados por el grupo, iniciá sesión. También podés crear cuenta si el registro público está habilitado.'
      : 'Ingresá tus datos para acceder a proyectos, eventos y rifas del grupo.';

  return (
    <div className="login-shell">
      <div className="login-page">
        <div className="login-card">
            <aside className="login-hero">
              <div className="login-hero-inner">
                <h2>{heroTitle}</h2>
                <p>{heroText}</p>
                {mode === 'signin' ? (
                  <button type="button" onClick={() => { setMode('signup'); setError(null); }}>
                    Crear cuenta
                  </button>
                ) : (
                  <button type="button" onClick={() => { setMode('signin'); setError(null); }}>
                    Iniciar sesión
                  </button>
                )}
              </div>
            </aside>

            <section className="login-forms">
              <div className="login-forms-wrap">
                <div className={`login-form-panel ${mode === 'signin' ? 'active' : ''}`}>
                  <div className="login-form-heading">
                    <h2>Iniciar sesión</h2>
                    <img
                      src="/logo.png?v=3"
                      srcSet="/logo@2x.png?v=3 2x, /logo@3x.png?v=3 3x"
                      width={64}
                      height={84}
                      sizes="(max-width: 760px) 52px, 64px"
                      alt="Clan Rover"
                      className="login-inline-logo"
                      decoding="async"
                    />
                  </div>
                  <p className="login-sub">Comunidad Rover San Juan XXIII</p>
                  <div className="login-social-row" aria-hidden="true">
                    <span className="login-social" title="Próximamente">G</span>
                    <span className="login-social" title="Próximamente">f</span>
                    <span className="login-social" title="Próximamente">&lt;&gt;</span>
                    <span className="login-social" title="Próximamente">in</span>
                  </div>
                  <p className="login-divider">o usá tu usuario del grupo</p>
                  {error && mode === 'signin' ? <p className="login-error">{error}</p> : null}
                  <form onSubmit={onSignIn}>
                    <input
                      className="login-field"
                      placeholder="Usuario"
                      name="username"
                      autoComplete="username"
                      value={signInUser}
                      onChange={(e) => setSignInUser(e.target.value)}
                      required
                    />
                    <input
                      className="login-field"
                      type="password"
                      placeholder="Contraseña"
                      name="password"
                      autoComplete="current-password"
                      value={signInPass}
                      onChange={(e) => setSignInPass(e.target.value)}
                      required
                    />
                    <button type="submit" className="login-submit" disabled={busy}>
                      {busy ? 'Ingresando…' : 'Ingresar'}
                    </button>
                  </form>
                </div>

                <div className={`login-form-panel ${mode === 'signup' ? 'active' : ''}`}>
                  <h2>Crear cuenta</h2>
                  <p className="login-sub">Solo funciona si el administrador habilitó el registro.</p>
                  <div className="login-social-row" aria-hidden="true">
                    <span className="login-social" title="Próximamente">G</span>
                    <span className="login-social" title="Próximamente">f</span>
                    <span className="login-social" title="Próximamente">&lt;&gt;</span>
                    <span className="login-social" title="Próximamente">in</span>
                  </div>
                  <p className="login-divider">o registrate con usuario y contraseña</p>
                  {error && mode === 'signup' ? <p className="login-error">{error}</p> : null}
                  <form onSubmit={onSignUp}>
                    <input
                      className="login-field"
                      placeholder="Nombre visible (opcional)"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      autoComplete="name"
                    />
                    <input
                      className="login-field"
                      placeholder="Usuario"
                      name="username"
                      autoComplete="username"
                      value={signUpUser}
                      onChange={(e) => setSignUpUser(e.target.value)}
                      required
                      minLength={3}
                    />
                    <input
                      className="login-field"
                      type="password"
                      placeholder="Contraseña (mín. 8 caracteres)"
                      name="password"
                      autoComplete="new-password"
                      value={signUpPass}
                      onChange={(e) => setSignUpPass(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button type="submit" className="login-submit" disabled={busy}>
                      {busy ? 'Creando…' : 'Crear cuenta'}
                    </button>
                  </form>
                </div>
              </div>
            </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
