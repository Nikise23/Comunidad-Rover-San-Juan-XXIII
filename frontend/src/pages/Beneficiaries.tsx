import { useEffect, useState } from 'react';
import { beneficiariesApi, type Beneficiary } from '../api/client';

const btn = { padding: '0.35rem 0.65rem', border: 'none', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' as const };
const btnEdit = { ...btn, background: 'var(--surface-hover)', color: 'var(--text)' };
const btnDanger = { ...btn, background: 'var(--danger)', color: '#fff' };

export default function Beneficiaries() {
  const [list, setList] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', dni: '', contact: '', role: '' });

  const load = () => {
    beneficiariesApi.list().then((res) => setList(res.data)).catch(() => setList([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ firstName: '', lastName: '', dni: '', contact: '', role: '' });
    setModal(true);
  };

  const openEdit = (b: Beneficiary) => {
    setEditingId(b.id);
    setForm({
      firstName: b.firstName,
      lastName: b.lastName,
      dni: b.dni,
      contact: b.contact || '',
      role: b.role || '',
    });
    setModal(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      beneficiariesApi.update(editingId, form).then(() => {
        setModal(false);
        setEditingId(null);
        load();
      });
    } else {
      beneficiariesApi.create(form).then(() => {
        setModal(false);
        setForm({ firstName: '', lastName: '', dni: '', contact: '', role: '' });
        load();
      });
    }
  };

  const remove = (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return;
    beneficiariesApi.delete(id).then(() => load());
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Beneficiarios</h1>
        <button type="button" className="touch-target" onClick={openCreate} style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Nuevo beneficiario</button>
      </div>
      {loading ? <p>Cargando...</p> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-hover)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Nombre</th>
                <th style={{ padding: '0.75rem 1rem' }}>DNI</th>
                <th style={{ padding: '0.75rem 1rem' }}>Contacto</th>
                <th style={{ padding: '0.75rem 1rem' }}>Rol</th>
                <th style={{ padding: '0.75rem 1rem' }}>Proyectos</th>
                <th style={{ padding: '0.75rem 1rem', width: 140 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>{b.firstName} {b.lastName}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{b.dni}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{b.contact || '-'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{b.role || '-'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{(b.projects || []).length}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button type="button" style={btnEdit} onClick={() => openEdit(b)}>Editar</button>
                    <button type="button" style={{ ...btnDanger, marginLeft: 8 }} onClick={() => remove(b.id, `${b.firstName} ${b.lastName}`)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {!list.length && <p style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>No hay beneficiarios.</p>}
        </div>
      )}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', width: '100%', maxWidth: 400, border: '1px solid var(--border)', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>{editingId ? 'Editar beneficiario' : 'Nuevo beneficiario'}</h3>
            <form onSubmit={submit}>
              <label style={{ display: 'block', marginBottom: 8 }}>Nombre</label>
              <input required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Apellido</label>
              <input required value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>DNI</label>
              <input required value={form.dni} onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Contacto</label>
              <input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Rol</label>
              <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
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
