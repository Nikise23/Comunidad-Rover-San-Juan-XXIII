import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { projectsApi, reportsApi } from '../api/client';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const btn = { padding: '0.35rem 0.65rem', border: 'none', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' as const };
const btnEdit = { ...btn, background: 'var(--surface-hover)', color: 'var(--text)' };
const btnDanger = { ...btn, background: 'var(--danger)', color: '#fff' };

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [financial, setFinancial] = useState<any>(null);
  const [editModal, setEditModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', budgetTarget: 0, startDate: '', endDate: '', status: 'activo' });

  useEffect(() => {
    if (!id) return;
    projectsApi.get(id).then((res) => setProject(res.data)).catch(() => setProject(null));
    reportsApi.projectFinancial(id).then((res) => setFinancial(res.data)).catch(() => setFinancial(null));
  }, [id]);

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
      projectsApi.get(id).then((r) => setProject(r.data));
      reportsApi.projectFinancial(id).then((r) => setFinancial(r.data));
    });
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
            <h3 style={{ marginBottom: '1rem' }}>Ranking beneficiarios</h3>
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
      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Eventos</h3>
        {(project.events || []).map((e: any) => (
          <Link key={e.id} to={`/events/${e.id}`} style={{ display: 'block', padding: '0.75rem', background: 'var(--bg)', borderRadius: 8, marginBottom: 8, color: 'inherit', textDecoration: 'none' }}>
            {e.name} · {e.type} · ${Number(e.income).toLocaleString()}
          </Link>
        ))}
      </section>
      <section style={{ marginTop: '1.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Beneficiarios</h3>
        {(project.beneficiaries || []).map((b: any) => (
          <li key={b.id} style={{ listStyle: 'none', padding: '0.5rem 0' }}>{b.firstName} {b.lastName} · {b.dni}</li>
        ))}
      </section>

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
