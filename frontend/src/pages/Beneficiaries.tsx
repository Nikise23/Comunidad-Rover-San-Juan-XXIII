import { useEffect, useState } from 'react';
import { beneficiariesApi, projectsApi, type Beneficiary, type Project } from '../api/client';

const btn = { padding: '0.35rem 0.65rem', border: 'none', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' as const };
const btnEdit = { ...btn, background: 'var(--surface-hover)', color: 'var(--text)' };
const btnDanger = { ...btn, background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)' };

/** Carpeta de Google Drive para subir documentación de protagonistas */
const DOCS_DRIVE_FOLDER_URL = import.meta.env.VITE_DRIVE_DOCS_FOLDER || 'https://drive.google.com/drive/folders/1ZudLvqLE5H5XNwmRkXj9hggw_hT6o5RH?usp=sharing';

export default function Beneficiaries() {
  const formatDateDisplay = (value?: string | null) => {
    if (!value) return '';
    const base = String(value).slice(0, 10); // YYYY-MM-DD
    const [y, m, d] = base.split('-');
    if (!y || !m || !d) return base;
    return `${d}-${m}-${y}`;
  };
  const [list, setList] = useState<Beneficiary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', dni: '', contact: '', birthDate: '', role: '', documentationSubmitted: false, projectIds: [] as string[] });
  const [searchQuery, setSearchQuery] = useState('');

  const load = () => {
    beneficiariesApi.list().then((res) => setList(res.data)).catch(() => setList([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    projectsApi.list().then((res) => setProjects(res.data)).catch(() => setProjects([]));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ firstName: '', lastName: '', dni: '', contact: '', birthDate: '', role: '', documentationSubmitted: false, projectIds: [] });
    setModal(true);
  };

  const openEdit = (b: Beneficiary) => {
    setEditingId(b.id);
    const projectIds = (b.projects || []).map((p) => (typeof p === 'object' && p !== null && 'id' in p ? (p as Project).id : p as string));
    setForm({
      firstName: b.firstName,
      lastName: b.lastName,
      dni: b.dni,
      contact: b.contact || '',
      birthDate: b.birthDate ? String(b.birthDate).slice(0, 10) : '',
      role: b.role || '',
      documentationSubmitted: Boolean(b.documentationSubmitted),
      projectIds,
    });
    setModal(true);
  };

  const toggleDocumentation = (b: Beneficiary) => {
    beneficiariesApi.update(b.id, { documentationSubmitted: !b.documentationSubmitted }).then(() => load());
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const { projectIds, ...rest } = form;
    const payload = { ...rest, ...(editingId ? { projectIds } : (projectIds.length ? { projectIds } : {})) };
    if (editingId) {
      beneficiariesApi.update(editingId, payload).then(() => {
        setModal(false);
        setEditingId(null);
        load();
      });
    } else {
      beneficiariesApi.create(payload).then(() => {
        setModal(false);
        setForm({ firstName: '', lastName: '', dni: '', contact: '', birthDate: '', role: '', documentationSubmitted: false, projectIds: [] });
        load();
      });
    }
  };

  const toggleProject = (projectId: string) => {
    setForm((f) => ({
      ...f,
      projectIds: f.projectIds.includes(projectId)
        ? f.projectIds.filter((id) => id !== projectId)
        : [...f.projectIds, projectId],
    }));
  };

  const remove = (id: string, name: string) => {
    if (!window.confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return;
    beneficiariesApi.delete(id).then(() => load());
  };

  const q = (searchQuery || '').trim().toLowerCase();
  const filteredList = q
    ? list.filter(
        (b) =>
          `${b.firstName} ${b.lastName}`.toLowerCase().includes(q) ||
          (b.dni || '').toLowerCase().includes(q) ||
          (b.contact || '').toLowerCase().includes(q) ||
          (b.role || '').toLowerCase().includes(q),
      )
    : list;
  const sortedList = [...filteredList].sort((a, b) => {
    const ln = (a.lastName || '').localeCompare(b.lastName || '', 'es');
    if (ln !== 0) return ln;
    return (a.firstName || '').localeCompare(b.firstName || '', 'es');
  });

  const totalProtagonistas = list.filter(
    (b) => (b.role || '').trim().toLowerCase() === 'protagonista' || (b.role || '').trim().toLowerCase() === 'scout',
  ).length;
  const totalEducadores = list.filter(
    (b) => (b.role || '').trim().toLowerCase() === 'educador',
  ).length;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Protagonistas</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="touch-target" onClick={async () => {
            try {
              const res = await beneficiariesApi.exportCsv();
              const blob = new Blob([res.data as any], { type: 'text/csv;charset=utf-8;' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'protagonistas.csv';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            } catch {
              // ignore errors for now
            }
          }} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontWeight: 500 }}>
            Descargar CSV
          </button>
          <button type="button" className="touch-target" onClick={openCreate} style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Nuevo protagonista</button>
        </div>
      </div>
      {!loading && (
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Buscar por nombre, apellido, DNI, contacto o rol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', maxWidth: 400, padding: '0.5rem 0.75rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {q && <span>{sortedList.length} resultado{sortedList.length !== 1 ? 's' : ''}</span>}
            <span>Total protagonistas: <strong style={{ color: 'var(--text)' }}>{totalProtagonistas}</strong></span>
            <span>Total educadores: <strong style={{ color: 'var(--text)' }}>{totalEducadores}</strong></span>
          </div>
        </div>
      )}
      {loading ? <p>Cargando...</p> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-hover)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Apellido, Nombre</th>
                <th style={{ padding: '0.75rem 1rem' }}>DNI</th>
                <th style={{ padding: '0.75rem 1rem' }}>Fecha nac.</th>
                <th style={{ padding: '0.75rem 1rem' }}>Contacto</th>
                <th style={{ padding: '0.75rem 1rem' }}>Rol</th>
                <th style={{ padding: '0.75rem 1rem' }}>Documentación</th>
                <th style={{ padding: '0.75rem 1rem' }}>Proyectos</th>
                <th style={{ padding: '0.75rem 1rem', width: 140 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedList.map((b) => (
                <tr key={b.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>{b.lastName}, {b.firstName}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{b.dni}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{b.birthDate ? formatDateDisplay(b.birthDate) : '-'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{b.contact || '-'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{(b.role || '').toLowerCase().trim() === 'scout' ? 'Protagonista' : (b.role || '-')}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(b.documentationSubmitted)}
                          onChange={() => toggleDocumentation(b)}
                          style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
                        />
                        <span style={{ fontSize: '0.85rem' }}>{b.documentationSubmitted ? 'Entregada' : 'Pendiente'}</span>
                      </label>
                      <a
                        href={DOCS_DRIVE_FOLDER_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.85rem', color: 'var(--accent)' }}
                      >
                        Abrir carpeta Drive
                      </a>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>{(b.projects || []).length}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button type="button" style={btnEdit} onClick={() => openEdit(b)}>Editar</button>
                    <button type="button" style={{ ...btnDanger, marginLeft: 8 }} onClick={() => remove(b.id, `${b.lastName}, ${b.firstName}`)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {!list.length && <p style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>No hay protagonistas.</p>}
          {list.length > 0 && !sortedList.length && <p style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>Ningún protagonista coincide con la búsqueda.</p>}
        </div>
      )}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', width: '100%', maxWidth: 400, border: '1px solid var(--border)', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>{editingId ? 'Editar protagonista' : 'Nuevo protagonista'}</h3>
            <form onSubmit={submit}>
              <label style={{ display: 'block', marginBottom: 8 }}>Nombre</label>
              <input required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Apellido</label>
              <input required value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>DNI</label>
              <input required value={form.dni} onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Contacto</label>
              <input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Fecha de nacimiento</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
              />
              <label style={{ display: 'block', marginBottom: 8 }}>Rol</label>
              <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="ej. Protagonista" style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.documentationSubmitted}
                    onChange={(e) => setForm((f) => ({ ...f, documentationSubmitted: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
                  />
                  <span>Documentación entregada</span>
                </label>
                <p style={{ marginTop: 6, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <a href={DOCS_DRIVE_FOLDER_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                    Abrir carpeta en Drive para crear subcarpetas y subir archivos
                  </a>
                </p>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 8 }}>Proyectos</label>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {editingId ? 'Marcá los proyectos a los que pertenece.' : 'Opcional. Si no elegís ninguno, se asigna al proyecto por defecto.'}
                </p>
                <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--bg)' }}>
                  {projects.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No hay proyectos cargados.</p>}
                  {projects.map((p) => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.projectIds.includes(p.id)}
                        onChange={() => toggleProject(p.id)}
                        style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
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
