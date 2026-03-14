import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { projectsApi, reportsApi, contributionsApi, beneficiariesApi } from '../api/client';
import type { Contribution } from '../api/client';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const btn = { padding: '0.35rem 0.65rem', border: 'none', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' as const };
const btnEdit = { ...btn, background: 'var(--surface-hover)', color: 'var(--text)' };
const btnDanger = { ...btn, background: 'var(--danger)', color: '#fff' };

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [financial, setFinancial] = useState<any>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [scoutSummary, setScoutSummary] = useState<{ beneficiaryId: string; fullName: string; totalContributions: number; totalEarningsFromEvents: number; total: number }[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [editModal, setEditModal] = useState(false);
  const [contributionModal, setContributionModal] = useState(false);
  const [contributionForm, setContributionForm] = useState({ beneficiaryId: '', amount: 0, date: '', note: '' });
  const [contributionBeneficiarySearch, setContributionBeneficiarySearch] = useState('');
  const [form, setForm] = useState({ name: '', description: '', budgetTarget: 0, startDate: '', endDate: '', status: 'activo' });

  const load = () => {
    if (!id) return;
    projectsApi.get(id).then((res) => setProject(res.data)).catch(() => setProject(null));
    reportsApi.projectFinancial(id).then((res) => setFinancial(res.data)).catch(() => setFinancial(null));
    contributionsApi.listByProject(id).then((res) => setContributions(res.data)).catch(() => setContributions([]));
    reportsApi.getProjectScoutSummary(id).then((res) => setScoutSummary(res.data)).catch(() => setScoutSummary([]));
  };

  useEffect(() => {
    load();
  }, [id]);
  useEffect(() => {
    beneficiariesApi.list().then((res) => setBeneficiaries(res.data)).catch(() => setBeneficiaries([]));
  }, []);

  const openEdit = () => {
    if (!project) return;
    setForm({
      name: project.name,
      description: project.description || '',
      budgetTarget: Number(project.budgetTarget) || 0,
      startDate: project.startDate ? String(project.startDate).slice(0, 10) : '',
      endDate: project.endDate ? String(project.endDate).slice(0, 10) : '',
      status: project.status || 'activo',
    });
    setEditModal(true);
  };

  const saveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    projectsApi.update(id, {
      name: form.name,
      description: form.description || undefined,
      budgetTarget: form.budgetTarget,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      status: form.status as 'activo' | 'finalizado',
    }).then(() => {
      setEditModal(false);
      load();
    });
  };

  const openAddContribution = () => {
    setContributionForm({ beneficiaryId: '', amount: 0, date: new Date().toISOString().slice(0, 10), note: '' });
    setContributionBeneficiarySearch('');
    setContributionModal(true);
  };

  const contributionBeneficiaryFiltered = (contributionBeneficiarySearch || '').trim()
    ? beneficiaries.filter(
        (b) =>
          `${b.firstName} ${b.lastName}`.toLowerCase().includes(contributionBeneficiarySearch.trim().toLowerCase()),
      )
    : beneficiaries;
  const contributionBeneficiarySorted = [...contributionBeneficiaryFiltered].sort((a, b) => {
    const ln = (a.lastName || '').localeCompare(b.lastName || '', 'es');
    if (ln !== 0) return ln;
    return (a.firstName || '').localeCompare(b.firstName || '', 'es');
  });

  const saveContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !contributionForm.beneficiaryId || contributionForm.amount <= 0) return;
    contributionsApi.create(id, {
      beneficiaryId: contributionForm.beneficiaryId,
      amount: contributionForm.amount,
      date: contributionForm.date || undefined,
      note: contributionForm.note || undefined,
    }).then(() => {
      setContributionModal(false);
      load();
    });
  };

  const deleteContribution = (c: Contribution) => {
    if (!window.confirm('¿Eliminar este aporte?')) return;
    contributionsApi.delete(c.id).then(() => load());
  };

  const removeProject = () => {
    if (!id || !project) return;
    if (!window.confirm(`¿Eliminar el proyecto "${project.name}"? Se eliminarán eventos y datos asociados.`)) return;
    projectsApi.delete(id).then(() => navigate('/projects'));
  };

  if (!project) return <div>Cargando proyecto...</div>;

  const totalRaised = (project.events || []).reduce((s: number, e: any) => s + Number(e.income), 0);
  const target = Number(project.budgetTarget) || 1;
  const progress = Math.min(100, Math.round((totalRaised / target) * 100));

  const incomeChart = financial?.incomeByEvent?.length ? {
    labels: financial.incomeByEvent.map((e: any) => e.eventName),
    datasets: [
      { label: 'Ingresos', data: financial.incomeByEvent.map((e: any) => e.income), backgroundColor: 'rgba(245, 158, 11, 0.7)' },
      { label: 'Gastos', data: financial.incomeByEvent.map((e: any) => e.expenses), backgroundColor: 'rgba(239, 68, 68, 0.5)' },
    ],
  } : null;

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/projects" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>← Proyectos</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 8 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', marginTop: 4 }}>{project.name}</h1>
            <p style={{ color: 'var(--text-muted)' }}>{project.description || 'Sin descripción'}</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" style={btnEdit} onClick={openEdit}>Editar proyecto</button>
            <button type="button" style={btnDanger} onClick={removeProject}>Eliminar proyecto</button>
          </div>
        </div>
        <div style={{ marginTop: 12, height: 12, background: 'var(--border)', borderRadius: 6, maxWidth: 400, overflow: 'hidden' }}>
          <div style={{ width: progress + '%', height: '100%', background: 'var(--accent)', borderRadius: 6 }} />
        </div>
        <p style={{ marginTop: 8 }}>Recaudado: <strong>${totalRaised.toLocaleString()}</strong> / ${target.toLocaleString()} ({progress}%)</p>
      </div>
      {financial && (
        <div className="resp-grid-2-cols" style={{ marginBottom: '2rem' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Ingresos por evento</h3>
            {incomeChart && <div style={{ height: 260 }}><Bar data={incomeChart} options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }} /></div>}
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
            <h3 style={{ marginBottom: '0.25rem' }}>Ranking protagonistas</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Por ganancia personal en eventos del proyecto</p>
            <ul style={{ listStyle: 'none' }}>
              {(financial.beneficiaryRanking || []).slice(0, 10).map((r: any, i: number) => (
                <li key={r.beneficiaryId} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>#{i + 1} {r.fullName}</span>
                  <strong>${r.total.toLocaleString()}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Aportes y avance de scouts</h3>
          <button type="button" className="touch-target" onClick={openAddContribution} style={{ padding: '0.4rem 0.8rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 8, fontWeight: 600 }}>
            Registrar aporte
          </button>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Lo que cada scout va pagando (aportes) más la ganancia personal de los eventos del proyecto.
        </p>
        <div className="table-responsive" style={{ marginBottom: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Scout</th>
                <th style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Aportes</th>
                <th style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Ganancia personal (eventos)</th>
                <th style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontWeight: 500 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {scoutSummary.map((s) => (
                <tr key={s.beneficiaryId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 0' }}>{s.fullName}</td>
                  <td style={{ padding: '0.75rem 0' }}>${s.totalContributions.toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 0', color: 'var(--success)' }}>${s.totalEarningsFromEvents.toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 0', fontWeight: 600 }}>${s.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {scoutSummary.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Aún no hay aportes ni ganancias de eventos. Registrá un aporte o generá ventas/rifas en los eventos del proyecto.</p>}
        {contributions.length > 0 && (
          <>
            <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.95rem' }}>Últimos aportes registrados</h4>
            <ul style={{ listStyle: 'none' }}>
              {contributions.slice(0, 10).map((c) => (
                <li key={c.id} style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <span>{(c.beneficiary as any) ? `${(c.beneficiary as any).firstName} ${(c.beneficiary as any).lastName}` : c.beneficiaryId} · ${Number(c.amount).toLocaleString()} {c.date ? ` · ${String(c.date).slice(0, 10)}` : ''}</span>
                  <button type="button" style={{ ...btnDanger, fontSize: '0.75rem' }} onClick={() => deleteContribution(c)}>Eliminar</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Eventos</h3>
        {(project.events || []).map((e: any) => (
          <Link key={e.id} to={`/events/${e.id}`} style={{ display: 'block', padding: '0.75rem', background: 'var(--bg)', borderRadius: 8, marginBottom: 8, color: 'inherit', textDecoration: 'none' }}>
            {e.name} · {e.type} · ${Number(e.income).toLocaleString()}
          </Link>
        ))}
      </section>
      <section style={{ marginTop: '1.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Protagonistas</h3>
        {(project.beneficiaries || []).map((b: any) => (
          <li key={b.id} style={{ listStyle: 'none', padding: '0.5rem 0' }}>{b.firstName} {b.lastName} · {b.dni}</li>
        ))}
      </section>

      {contributionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setContributionModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Registrar aporte</h3>
            <form onSubmit={saveContribution}>
              <label style={{ display: 'block', marginBottom: 8 }}>Scout / Protagonista</label>
              <input
                type="text"
                placeholder="Buscar por nombre o apellido..."
                value={contributionBeneficiarySearch}
                onChange={(e) => setContributionBeneficiarySearch(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginBottom: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
              />
              <select required value={contributionForm.beneficiaryId} onChange={(e) => setContributionForm((f) => ({ ...f, beneficiaryId: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}>
                <option value="">Seleccionar</option>
                {contributionBeneficiarySorted.map((b) => (
                  <option key={b.id} value={b.id}>{b.firstName} {b.lastName}</option>
                ))}
              </select>
              {contributionBeneficiarySearch.trim() && !contributionBeneficiarySorted.length && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: -4, marginBottom: 8 }}>Ningún scout coincide con la búsqueda.</p>
              )}
              <label style={{ display: 'block', marginBottom: 8 }}>Monto</label>
              <input type="number" required min={0.01} step="0.01" value={contributionForm.amount || ''} onChange={(e) => setContributionForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Fecha (opcional)</label>
              <input type="date" value={contributionForm.date} onChange={(e) => setContributionForm((f) => ({ ...f, date: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Nota (opcional)</label>
              <input value={contributionForm.note} onChange={(e) => setContributionForm((f) => ({ ...f, note: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} placeholder="Ej. Pago parcial marzo" />
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Guardar</button>
                <button type="button" onClick={() => setContributionModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setEditModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Editar proyecto</h3>
            <form onSubmit={saveProject}>
              <label style={{ display: 'block', marginBottom: 8 }}>Nombre</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Descripción</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Presupuesto objetivo</label>
              <input type="number" required min={0} value={form.budgetTarget || ''} onChange={(e) => setForm((f) => ({ ...f, budgetTarget: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Fecha inicio</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Fecha fin</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Estado</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}>
                <option value="activo">Activo</option>
                <option value="finalizado">Finalizado</option>
              </select>
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Guardar</button>
                <button type="button" onClick={() => setEditModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
