import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi, type Project } from '../api/client';

const btn = { padding: '0.35rem 0.65rem', border: 'none', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' as const };
const btnEdit = { ...btn, background: 'var(--surface-hover)', color: 'var(--text)' };
const btnDanger = { ...btn, background: 'var(--danger)', color: '#fff' };

export default function Projects() {
  const [list, setList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', budgetTarget: 0, startDate: '', endDate: '', status: 'activo' });

  const load = () => {
    projectsApi.list().then((res) => setList(res.data)).catch(() => setList([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', description: '', budgetTarget: 0, startDate: '', endDate: '', status: 'activo' });
    setModal(true);
  };

  const openEdit = (p: Project) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || '',
      budgetTarget: Number(p.budgetTarget) || 0,
      startDate: typeof p.startDate === 'string' ? (p.startDate || '').slice(0, 10) : '',
      endDate: typeof p.endDate === 'string' ? (p.endDate || '').slice(0, 10) : '',
      status: p.status || 'activo',
    });
    setModal(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description || undefined,
      budgetTarget: form.budgetTarget,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      status: form.status as 'activo' | 'finalizado',
    };
    if (editingId) {
      projectsApi.update(editingId, payload).then(() => { setModal(false); setEditingId(null); load(); });
    } else {
      projectsApi.create(payload).then(() => { setModal(false); setForm({ name: '', description: '', budgetTarget: 0, startDate: '', endDate: '', status: 'activo' }); load(); });
    }
  };

  const remove = (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar el proyecto "${name}"? Se eliminarán también sus eventos y datos asociados.`)) return;
    projectsApi.delete(id).then(() => load());
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Proyectos</h1>
        <button type="button" className="touch-target" onClick={openCreate} style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Nuevo proyecto</button>
      </div>
      {loading ? <p>Cargando...</p> : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {list.map((p) => {
            const evs = p.events || [];
            const totalRaised = evs.reduce((s, e) => s + Number(e.income), 0);
            const target = Number(p.budgetTarget) || 1;
            const progress = Math.min(100, Math.round((totalRaised / target) * 100));
            return (
              <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <Link to={`/projects/${p.id}`} style={{ flex: 1, textDecoration: 'none', color: 'inherit' }}>
                    <h3 style={{ fontSize: '1.1rem' }}>{p.name}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.description || 'Sin descripcion'}</p>
                    <div style={{ marginTop: 8, height: 6, background: 'var(--border)', borderRadius: 3, width: 200, overflow: 'hidden' }}>
                      <div style={{ width: String(progress) + '%', height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>${totalRaised.toLocaleString()} / ${target.toLocaleString()} · {evs.length} eventos</p>
                  </Link>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button type="button" style={btnEdit} onClick={() => openEdit(p)}>Editar</button>
                    <button type="button" style={btnDanger} onClick={() => remove(p.id, p.name)}>Eliminar</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>{editingId ? 'Editar proyecto' : 'Nuevo proyecto'}</h3>
            <form onSubmit={submit}>
              <label style={{ display: 'block', marginBottom: 8 }}>Nombre</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Descripcion</label>
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
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>{editingId ? 'Guardar' : 'Crear'}</button>
                <button type="button" onClick={() => setModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
