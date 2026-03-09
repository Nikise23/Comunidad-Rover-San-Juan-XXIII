import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { reportsApi, type DashboardData } from '../api/client';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
  },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#8b9cb3' } },
    x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#8b9cb3' } },
  },
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi.dashboard()
      .then((res) => setData(res.data))
      .catch(() => setData({ projects: [], recentEvents: [], beneficiaryRanking: [], scoutRaffleEarnings: [], evolution: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '2rem' }}>Cargando dashboard...</div>;
  if (!data) return null;

  const evolutionChart = {
    labels: data.evolution.map((e) => e.label),
    datasets: [{ label: 'Recaudación', data: data.evolution.map((e) => e.total), backgroundColor: 'rgba(245, 158, 11, 0.7)' }],
  };

  const rankingChart = {
    labels: data.beneficiaryRanking.slice(0, 8).map((r) => r.fullName),
    datasets: [{ data: data.beneficiaryRanking.slice(0, 8).map((r) => r.total), backgroundColor: ['#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f', '#451a03', '#fbbf24', '#fcd34d'] }],
  };

  return (
    <div className="page-container">
      <h1 style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-display)' }}>Dashboard</h1>

      <section className="resp-grid-1-2-4" style={{ marginBottom: '2rem' }}>
        {data.projects.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '1.25rem',
                transition: 'border-color 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{p.name}</h3>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: '0.5rem' }}>
                <div style={{ width: `${p.progressPercent}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                ${p.totalRaised.toLocaleString()} / ${p.budgetTarget.toLocaleString()} · {p.eventsCount} eventos
              </p>
            </div>
          </Link>
        ))}
      </section>

      <div className="resp-grid-2-cols" style={{ marginBottom: '2rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', minHeight: 280 }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Evolución de recaudación</h3>
          <div style={{ height: 220, width: '100%' }}>
            <Bar data={evolutionChart} options={chartOptions} />
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', minHeight: 280 }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Ranking beneficiarios</h3>
          <div style={{ height: 220, width: '100%' }}>
            {rankingChart.labels.length ? <Doughnut data={rankingChart} options={{ responsive: true, maintainAspectRatio: false }} /> : <p style={{ color: 'var(--text-muted)' }}>Sin datos</p>}
          </div>
        </div>
      </div>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Ganancias personales (scouts)</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Total por scout: rifas + otros eventos (empanadas, ventas, etc.). Desglose por evento debajo.</p>
        <div className="table-responsive">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Scout / Beneficiario</th>
              <th style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Total ganancia personal</th>
            </tr>
          </thead>
          <tbody>
            {(data.scoutRaffleEarnings ?? []).map((r) => (
              <tr key={r.beneficiaryId} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.75rem 0', verticalAlign: 'top' }}>
                  <div>{r.fullName}</div>
                  {(r.byEvent ?? []).length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {r.byEvent.map((e) => (
                        <div key={e.eventId}>{e.eventName}: ${e.scoutEarnings.toLocaleString()}</div>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ padding: '0.75rem 0', color: 'var(--success)', fontWeight: 600, verticalAlign: 'top' }}>${r.totalScoutEarnings.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!(data.scoutRaffleEarnings ?? []).length && <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Aún no hay ganancias por rifas.</p>}
      </section>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Últimos eventos</h3>
        <div className="table-responsive">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Evento</th>
              <th style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Tipo</th>
              <th style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Fecha</th>
              <th style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Ingresos</th>
              <th style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Ganancias</th>
              <th style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontWeight: 500 }}></th>
            </tr>
          </thead>
          <tbody>
            {data.recentEvents.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.75rem 0' }}>{e.name}</td>
                <td style={{ padding: '0.75rem 0', color: 'var(--text-muted)' }}>{e.type}</td>
                <td style={{ padding: '0.75rem 0' }}>{e.date}</td>
                <td style={{ padding: '0.75rem 0' }}>${e.income.toLocaleString()}</td>
                <td style={{ padding: '0.75rem 0', color: e.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>${e.netProfit.toLocaleString()}</td>
                <td style={{ padding: '0.75rem 0' }}>
                  <Link to={`/events/${e.id}`}>Ver</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {!data.recentEvents.length && <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No hay eventos recientes.</p>}
      </section>
    </div>
  );
}
