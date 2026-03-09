import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi, projectsApi, type Event, type Project } from '../api/client';

const btn = { padding: '0.35rem 0.65rem', border: 'none', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' as const };
const btnEdit = { ...btn, background: 'var(--surface-hover)', color: 'var(--text)' };
const btnDanger = { ...btn, background: 'var(--danger)', color: '#fff' };

export default function Events() {
  const [list, setList] = useState<Event[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterProject, setFilterProject] = useState<string>('');
  const [form, setForm] = useState({ name: '', type: 'venta_empanadas', date: '', projectId: '', responsibleId: '', income: 0, expenses: 0 });

  const load = () => {
    eventsApi.list(filterProject || undefined).then((res) => setList(res.data)).catch(() => setList([])).finally(() => setLoading(false));
    projectsApi.list().then((res) => setProjects(res.data)).catch(() => setProjects([]));
  };

  useEffect(() => { load(); }, [filterProject]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', type: 'venta_empanadas', date: '', projectId: filterProject || '', responsibleId: '', income: 0, expenses: 0 });
    setModal(true);
  };

  const openEdit = (e: Event) => {
    setEditingId(e.id);
    setForm({
      name: e.name,
      type: e.type,
      date: typeof e.date === 'string' ? e.date.slice(0, 10) : String((e as any).date).slice(0, 10),
      projectId: e.projectId,
      responsibleId: (e as any).responsibleId || '',
      income: Number(e.income) || 0,
      expenses: Number(e.expenses) || 0,
    });
    setModal(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectId) return;
    const payload = {
      name: form.name,
      type: form.type,
      date: form.date,
      projectId: form.projectId,
      responsibleId: form.responsibleId || undefined,
      income: form.income,
      expenses: form.expenses,
    };
    if (editingId) {
      eventsApi.update(editingId, payload).then(() => { setModal(false); setEditingId(null); load(); });
    } else {
      eventsApi.create(payload).then(() => { setModal(false); setForm({ name: '', type: 'venta_empanadas', date: '', projectId: '', responsibleId: '', income: 0, expenses: 0 }); load(); });
    }
  };

  const remove = (eventId: string, name: string) => {
    if (!window.confirm(`¿Eliminar el evento "${name}"? Se eliminarán productos, ventas y rifas asociados.`)) return;
    eventsApi.delete(eventId).then(() => load());
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Eventos de recaudación</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="touch-target" style={{ padding: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)' }}>
            <option value="">Todos los proyectos</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="button" className="touch-target" onClick={openCreate} style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Nuevo evento</button>
        </div>
      </div>

      {loading ? <p>Cargando...</p> : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {list.map((ev) => {
            const net = Number(ev.income) - Number(ev.expenses);
            return (
              <div key={ev.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <Link to={`/events/${ev.id}`} style={{ flex: 1, textDecoration: 'none', color: 'inherit' }}>
                  <h3 style={{ fontSize: '1.1rem' }}>{ev.name}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>{ev.type} · {(ev as any).project?.name || ev.projectId}</p>
                  <p style={{ fontSize: '0.9rem', marginTop: 4 }}>Ingresos: ${Number(ev.income).toLocaleString()} · Ganancia: ${net.toLocaleString()}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{typeof ev.date === 'string' ? ev.date.slice(0, 10) : (ev.date as any)?.split?.('T')?.[0]}</p>
                </Link>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button type="button" style={btnEdit} onClick={() => openEdit(ev)}>Editar</button>
                  <button type="button" style={btnDanger} onClick={() => remove(ev.id, ev.name)}>Eliminar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && !list.length && <p style={{ color: 'var(--text-muted)' }}>No hay eventos.</p>}

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>{editingId ? 'Editar evento' : 'Nuevo evento'}</h3>
            <form onSubmit={submit}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem' }}>Nombre</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem' }}>Tipo</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}>
                <option value="venta_empanadas">Venta de empanadas</option>
                <option value="venta_pizzas">Venta de pizzas</option>
                <option value="rifa">Rifa</option>
                <option value="feria">Feria</option>
                <option value="venta_solidaria">Venta solidaria</option>
              </select>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem' }}>Fecha</label>
              <input type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem' }}>Proyecto</label>
              <select required value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}>
                <option value="">Seleccionar</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem' }}>Ingresos (manual)</label>
              <input type="number" min={0} value={form.income || ''} onChange={(e) => setForm((f) => ({ ...f, income: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem' }}>Gastos</label>
              <input type="number" min={0} value={form.expenses || ''} onChange={(e) => setForm((f) => ({ ...f, expenses: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
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
