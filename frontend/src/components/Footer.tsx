export default function Footer() {
  const year = new Date().getFullYear();

  const technologies = [
    { name: 'React' },
    { name: 'NestJS' },
    { name: 'PostgreSQL' },
    { name: 'Chart.js' },
  ];

  return (
    <footer
      style={{
        width: '100%',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        padding: '2rem 1.5rem',
        marginTop: 'auto',
      }}
    >
      <div
        className="footer-inner"
        style={{
          maxWidth: 900,
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        {/* Sistema */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 4,
            }}
          >
            Sistema de Gestión de Proyectos Rover
          </h3>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              maxWidth: 480,
              margin: '0 auto',
            }}
          >
            Plataforma para gestionar proyectos, eventos de recaudación y rifas de la comunidad Rover.
          </p>
        </div>

        {/* Desarrollador y tecnologías */}
        <div
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginBottom: '1rem',
          }}
        >
          <p style={{ marginBottom: 6 }}>
            Desarrollado por <strong style={{ color: 'var(--text)' }}>Nicolás Fernández</strong>
          </p>
          <p style={{ marginBottom: 8 }}>
            Tecnologías: {technologies.map((t) => t.name).join(' · ')}
          </p>
          <p style={{ marginBottom: 0 }}>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ marginRight: '1rem' }}>
              GitHub
            </a>
            <a href="#" target="_blank" rel="noopener noreferrer">
              Portfolio
            </a>
          </p>
        </div>

        {/* Copyright */}
        <p
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            opacity: 0.9,
            margin: 0,
          }}
        >
          © {year} Sistema de Gestión Rover
        </p>
      </div>
    </footer>
  );
}
