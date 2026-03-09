import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { eventsApi, salesApi, beneficiariesApi, rafflesApi, projectsApi, reportsApi } from '../api/client';
import type { Event, Beneficiary, Product, Sale } from '../api/client';

function salePersonalGain(s: Sale): number {
  const product = s.product as Product | undefined;
  if (!product) return 0;
  const pricePerUnit = Number(product.pricePerUnit) || 0;
  const earningsPerUnit = product.scoutEarningsPerUnit != null ? Number(product.scoutEarningsPerUnit) : pricePerUnit;
  return (Number(s.quantity) || 0) * earningsPerUnit;
}

function buildEventCsv(
  event: Event,
  salesList: Sale[],
  ranking: { fullName: string; total: number; scoutEarnings: number }[],
): string {
  const income = Number(event.income) || 0;
  const expenses = Number(event.expenses) || 0;
  const profit = income - expenses;
  const sep = ';';
  const enc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines: string[] = [
    'Resumen del evento',
    ['Concepto', 'Valor'].map(enc).join(sep),
    ['Ingresos', income].map(enc).join(sep),
    ['Gastos', expenses].map(enc).join(sep),
    ['Ganancia del evento', profit].map(enc).join(sep),
    '',
    'Ventas registradas',
    ['Beneficiario', 'Producto', 'Cantidad', 'Monto', 'Ganancia personal'].map(enc).join(sep),
    ...salesList.map((s) => {
      const beneficiary = (s.beneficiary as { firstName?: string; lastName?: string } | undefined);
      const name = beneficiary ? `${beneficiary.firstName || ''} ${beneficiary.lastName || ''}`.trim() : s.beneficiaryId;
      const productName = (s.product as { name?: string } | undefined)?.name || s.productId;
      return [name, productName, s.quantity, Number(s.amount) || 0, salePersonalGain(s)].map(enc).join(sep);
    }),
    '',
    'Ranking de ventas',
    ['#', 'Beneficiario', 'Total ventas', 'Ganancia personal'].map(enc).join(sep),
    ...ranking.map((r, i) => [i + 1, r.fullName, r.total, r.scoutEarnings].map(enc).join(sep)),
  ];
  return '\uFEFF' + lines.join('\r\n'); // BOM for Excel
}

const btn = { padding: '0.35rem 0.65rem', border: 'none', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' as const };
const btnEdit = { ...btn, background: 'var(--surface-hover)', color: 'var(--text)' };
const btnDanger = { ...btn, background: 'var(--danger)', color: '#fff' };

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [ranking, setRanking] = useState<{ beneficiaryId: string; fullName: string; total: number; scoutEarnings: number }[]>([]);
  const [raffleRanking, setRaffleRanking] = useState<{ beneficiaryId: string; fullName: string; totalSold: number; scoutEarnings: number }[]>([]);
  const [raffles, setRaffles] = useState<any[]>([]);
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [saleModal, setSaleModal] = useState(false);
  const [saleForm, setSaleForm] = useState({ quantity: 0, beneficiaryId: '', productId: '' });
  const [productModal, setProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ name: '', unit: '', pricePerUnit: 0, totalQuantity: 0, scoutEarningsMode: 'total' as 'total' | 'fixed', scoutEarningsAmount: 0 });
  const [raffleModal, setRaffleModal] = useState(false);
  const [raffleForm, setRaffleForm] = useState({ name: '', pricePerNumber: 0, totalNumbers: 0, scoutEarningsMode: 'total' as 'total' | 'fixed', scoutEarningsAmount: 0 });
  const [eventEditModal, setEventEditModal] = useState(false);
  const [eventForm, setEventForm] = useState({ name: '', type: 'venta_empanadas', date: '', projectId: '', income: 0, expenses: 0 });

  const loadEvent = () => {
    if (!id) return;
    eventsApi.get(id).then((res) => setEvent(res.data)).catch(() => setEvent(null));
    salesApi.ranking(id).then((res) => setRanking(res.data)).catch(() => setRanking([]));
    salesApi.list({ eventId: id }).then((res) => setSalesList(res.data)).catch(() => setSalesList([]));
    rafflesApi.list(id).then((res) => setRaffles(res.data)).catch(() => setRaffles([]));
    reportsApi.getEventRaffleRanking(id).then((res) => setRaffleRanking(res.data)).catch(() => setRaffleRanking([]));
  };

  useEffect(() => {
    loadEvent();
  }, [id]);
  useEffect(() => {
    beneficiariesApi.list().then((res) => setBeneficiaries(res.data)).catch(() => setBeneficiaries([]));
    projectsApi.list().then((res) => setProjects(res.data)).catch(() => setProjects([]));
  }, []);

  const addSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !saleForm.beneficiaryId || !saleForm.productId) return;
    salesApi.create({
      eventId: id,
      beneficiaryId: saleForm.beneficiaryId,
      productId: saleForm.productId,
      quantity: saleForm.quantity,
    }).then(() => {
      setSaleModal(false);
      setSaleForm({ quantity: 0, beneficiaryId: '', productId: '' });
      loadEvent();
    });
  };

  const openAddProduct = () => {
    setEditingProductId(null);
    setProductForm({ name: '', unit: '', pricePerUnit: 0, totalQuantity: 0, scoutEarningsMode: 'total', scoutEarningsAmount: 0 });
    setProductModal(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    const hasFixed = p.scoutEarningsPerUnit != null && Number(p.scoutEarningsPerUnit) >= 0;
    setProductForm({
      name: p.name,
      unit: p.unit || '',
      pricePerUnit: Number(p.pricePerUnit) || 0,
      totalQuantity: Number(p.totalQuantity) || 0,
      scoutEarningsMode: hasFixed ? 'fixed' : 'total',
      scoutEarningsAmount: hasFixed ? Number(p.scoutEarningsPerUnit) : 0,
    });
    setProductModal(true);
  };

  const saveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !productForm.name || productForm.pricePerUnit < 0) return;
    const scoutEarningsPerUnit = productForm.scoutEarningsMode === 'total' ? null : (productForm.scoutEarningsAmount >= 0 ? productForm.scoutEarningsAmount : null);
    const payload = {
      name: productForm.name,
      unit: productForm.unit || undefined,
      pricePerUnit: productForm.pricePerUnit,
      totalQuantity: productForm.totalQuantity || undefined,
      scoutEarningsPerUnit: scoutEarningsPerUnit ?? undefined,
    };
    if (editingProductId) {
      eventsApi.updateProduct(editingProductId, payload).then(() => { setProductModal(false); setEditingProductId(null); loadEvent(); });
    } else {
      eventsApi.addProduct({ eventId: id, ...payload }).then(() => { setProductModal(false); setProductForm({ name: '', unit: '', pricePerUnit: 0, totalQuantity: 0, scoutEarningsMode: 'total', scoutEarningsAmount: 0 }); loadEvent(); });
    }
  };

  const deleteProduct = (productId: string) => {
    if (!window.confirm('¿Eliminar este producto? Las ventas asociadas pueden verse afectadas.')) return;
    eventsApi.deleteProduct(productId).then(() => loadEvent());
  };

  const addRaffle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !raffleForm.name || raffleForm.pricePerNumber < 0 || raffleForm.totalNumbers < 1) return;
    const scoutEarningsPerNumber = raffleForm.scoutEarningsMode === 'total' ? null : (raffleForm.scoutEarningsAmount >= 0 ? raffleForm.scoutEarningsAmount : null);
    rafflesApi.create({
      eventId: id,
      name: raffleForm.name,
      pricePerNumber: raffleForm.pricePerNumber,
      totalNumbers: raffleForm.totalNumbers,
      scoutEarningsPerNumber: scoutEarningsPerNumber ?? undefined,
    }).then(() => {
      setRaffleModal(false);
      setRaffleForm({ name: '', pricePerNumber: 0, totalNumbers: 0, scoutEarningsMode: 'total', scoutEarningsAmount: 0 });
      loadEvent();
    });
  };

  const deleteRaffle = (raffleId: string, name: string) => {
    if (!window.confirm(`¿Eliminar la rifa "${name}"?`)) return;
    rafflesApi.delete(raffleId).then(() => loadEvent());
  };

  const deleteSale = (saleId: string) => {
    if (!window.confirm('¿Eliminar esta venta?')) return;
    salesApi.delete(saleId).then(() => loadEvent());
  };

  const openEditEvent = () => {
    if (!event) return;
    setEventForm({
      name: event.name,
      type: event.type,
      date: typeof event.date === 'string' ? event.date.slice(0, 10) : '',
      projectId: event.projectId,
      income: Number(event.income) || 0,
      expenses: Number(event.expenses) || 0,
    });
    setEventEditModal(true);
  };

  const saveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    eventsApi.update(id, {
      name: eventForm.name,
      type: eventForm.type,
      date: eventForm.date,
      projectId: eventForm.projectId,
      income: eventForm.income,
      expenses: eventForm.expenses,
    }).then(() => { setEventEditModal(false); loadEvent(); });
  };

  const deleteEvent = () => {
    if (!id || !event) return;
    if (!window.confirm(`¿Eliminar el evento "${event.name}"? Se eliminarán productos, ventas y rifas.`)) return;
    eventsApi.delete(id).then(() => navigate('/events'));
  };

  if (!event) return <div>Cargando evento...</div>;
  const net = Number(event.income) - Number(event.expenses);
  const products = (event as any).products || [];

  return (
    <div className="page-container">
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/events" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>← Eventos</Link>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 8 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', marginTop: 4 }}>{event.name}</h1>
            <p style={{ color: 'var(--text-muted)' }}>{event.type} · {(event as any).project?.name}</p>
            <p style={{ marginTop: 8 }}>Fecha: {typeof event.date === 'string' ? event.date.split('T')[0] : event.date}</p>
            <p>Ingresos: ${Number(event.income).toLocaleString()} · Gastos: ${Number(event.expenses).toLocaleString()} · <strong style={{ color: net >= 0 ? 'var(--success)' : 'var(--danger)' }}>Ganancia: ${net.toLocaleString()}</strong></p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="touch-target" style={btnEdit} onClick={openEditEvent}>Editar evento</button>
            <button type="button" className="touch-target" style={btnDanger} onClick={deleteEvent}>Eliminar evento</button>
          </div>
        </div>
      </div>

      {event.type !== 'rifa' && (
      <div className="resp-grid-2-cols" style={{ marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Ranking de ventas</h3>
          <button type="button" onClick={() => setSaleModal(true)} style={{ marginBottom: 12, padding: '0.4rem 0.8rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 8, fontWeight: 600 }}>Registrar venta</button>
          <ul style={{ listStyle: 'none' }}>
            {ranking.map((r, i) => (
              <li key={r.beneficiaryId} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
                <span>#{i + 1} {r.fullName}</span>
                <span style={{ textAlign: 'right' }}>
                  {r.scoutEarnings !== r.total && <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ventas: ${r.total.toLocaleString()}</span>}
                  <strong style={{ color: 'var(--success)' }}>Ganancia personal: ${r.scoutEarnings.toLocaleString()}</strong>
                </span>
              </li>
            ))}
          </ul>
          {!ranking.length && <p style={{ color: 'var(--text-muted)' }}>Sin ventas aún.</p>}
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Productos del evento</h3>
            <button type="button" onClick={openAddProduct} style={{ padding: '0.4rem 0.8rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 8, fontWeight: 600 }}>Agregar producto</button>
          </div>
          <ul style={{ listStyle: 'none' }}>
            {products.map((p: Product) => (
              <li key={p.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{p.name} · {p.unit || 'u'} · ${Number(p.pricePerUnit).toLocaleString()}{p.scoutEarningsPerUnit != null ? ` · Ganancia: $${Number(p.scoutEarningsPerUnit).toLocaleString()}/u` : ' · Ganancia: total'}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" style={btnEdit} onClick={() => openEditProduct(p)}>Editar</button>
                  <button type="button" style={btnDanger} onClick={() => deleteProduct(p.id)}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
          {!products.length && <p style={{ color: 'var(--text-muted)' }}>No hay productos.</p>}
        </div>
      </div>
      )}

      {event.type === 'rifa' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Ranking de ventas de rifas</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>Scouts por ganancia personal en las rifas de este evento.</p>
          <ul style={{ listStyle: 'none' }}>
            {raffleRanking.map((r, i) => (
              <li key={r.beneficiaryId} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>#{i + 1} {r.fullName} · {r.totalSold} número(s) vendido(s)</span>
                <strong style={{ color: 'var(--success)' }}>${r.scoutEarnings.toLocaleString()}</strong>
              </li>
            ))}
          </ul>
          {!raffleRanking.length && <p style={{ color: 'var(--text-muted)' }}>Aún no hay ventas de rifas en este evento.</p>}
        </div>
      )}

      {event.type !== 'rifa' && (salesList.length > 0 || ranking.length > 0) && (
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0 }}>Ventas registradas</h3>
            <button
              type="button"
              className="touch-target"
              onClick={() => {
                const csv = buildEventCsv(event, salesList, ranking);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `evento-${event.name.replace(/\s+/g, '-')}-${typeof event.date === 'string' ? event.date.slice(0, 10) : ''}.csv`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
              style={{ padding: '0.4rem 0.8rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, fontWeight: 600 }}
            >
              Exportar CSV
            </button>
          </div>
          {salesList.length > 0 ? (
          <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0' }}>Beneficiario</th>
                <th style={{ padding: '0.5rem 0' }}>Producto</th>
                <th style={{ padding: '0.5rem 0' }}>Cantidad</th>
                <th style={{ padding: '0.5rem 0' }}>Monto</th>
                <th style={{ padding: '0.5rem 0' }}>Ganancia personal</th>
                <th style={{ padding: '0.5rem 0', width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {salesList.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.5rem 0' }}>{(s.beneficiary as any) ? `${(s.beneficiary as any).firstName} ${(s.beneficiary as any).lastName}` : s.beneficiaryId}</td>
                  <td style={{ padding: '0.5rem 0' }}>{(s.product as any)?.name || s.productId}</td>
                  <td style={{ padding: '0.5rem 0' }}>{s.quantity}</td>
                  <td style={{ padding: '0.5rem 0' }}>${Number(s.amount).toLocaleString()}</td>
                  <td style={{ padding: '0.5rem 0', color: 'var(--success)', fontWeight: 600 }}>${salePersonalGain(s).toLocaleString()}</td>
                  <td style={{ padding: '0.5rem 0' }}>
                    <button type="button" style={btnDanger} onClick={() => deleteSale(s.id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No hay ventas registradas. El CSV incluirá resumen del evento y ranking si existe.</p>
          )}
        </section>
      )}

      {event.type === 'rifa' && (
      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Rifas</h3>
          <button type="button" onClick={() => setRaffleModal(true)} style={{ padding: '0.4rem 0.8rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 8, fontWeight: 600 }}>Nueva rifa</button>
        </div>
        {raffles.length > 0 ? (
          raffles.map((r) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg)', borderRadius: 8, marginBottom: 8 }}>
              <Link to={`/raffles?raffle=${r.id}`} style={{ flex: 1, color: 'inherit', textDecoration: 'none' }}>
                {r.name} · {r.totalNumbers} números · ${Number(r.pricePerNumber).toLocaleString()}/número
              </Link>
              <button type="button" style={btnDanger} onClick={() => deleteRaffle(r.id, r.name)}>Eliminar</button>
            </div>
          ))
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>No hay rifas.</p>
        )}
      </section>
      )}

      {saleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setSaleModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Registrar venta</h3>
            <form onSubmit={addSale}>
              <label style={{ display: 'block', marginBottom: 8 }}>Beneficiario</label>
              <select required value={saleForm.beneficiaryId} onChange={(e) => setSaleForm((f) => ({ ...f, beneficiaryId: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}>
                <option value="">Seleccionar</option>
                {beneficiaries.map((b) => <option key={b.id} value={b.id}>{b.firstName} {b.lastName}</option>)}
              </select>
              <label style={{ display: 'block', marginBottom: 8 }}>Producto</label>
              <select required value={saleForm.productId} onChange={(e) => setSaleForm((f) => ({ ...f, productId: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}>
                <option value="">Seleccionar</option>
                {products.map((p: Product) => <option key={p.id} value={p.id}>{p.name} (${Number(p.pricePerUnit).toLocaleString()})</option>)}
              </select>
              <label style={{ display: 'block', marginBottom: 8 }}>Cantidad</label>
              <input type="number" required min={1} value={saleForm.quantity || ''} onChange={(e) => setSaleForm((f) => ({ ...f, quantity: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Guardar</button>
                <button type="button" onClick={() => setSaleModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {productModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => { setProductModal(false); setEditingProductId(null); }}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>{editingProductId ? 'Editar producto' : 'Agregar producto'}</h3>
            <form onSubmit={saveProduct}>
              <label style={{ display: 'block', marginBottom: 8 }}>Nombre</label>
              <input required value={productForm.name} onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} placeholder="ej. Empanadas" />
              <label style={{ display: 'block', marginBottom: 8 }}>Unidad (ej. docena, unidad)</label>
              <input value={productForm.unit} onChange={(e) => setProductForm((f) => ({ ...f, unit: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Precio por unidad</label>
              <input type="number" required min={0} step="0.01" value={productForm.pricePerUnit || ''} onChange={(e) => setProductForm((f) => ({ ...f, pricePerUnit: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Cantidad total (opcional)</label>
              <input type="number" min={0} value={productForm.totalQuantity || ''} onChange={(e) => setProductForm((f) => ({ ...f, totalQuantity: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Ganancia personal del scout por unidad</label>
              <div style={{ marginBottom: 8 }}>
                <label style={{ marginRight: 12, cursor: 'pointer' }}>
                  <input type="radio" name="scoutEarningsMode" checked={productForm.scoutEarningsMode === 'total'} onChange={() => setProductForm((f) => ({ ...f, scoutEarningsMode: 'total' }))} />
                  {' '}Total (precio del producto)
                </label>
                <label style={{ cursor: 'pointer' }}>
                  <input type="radio" name="scoutEarningsMode" checked={productForm.scoutEarningsMode === 'fixed'} onChange={() => setProductForm((f) => ({ ...f, scoutEarningsMode: 'fixed' }))} />
                  {' '}Monto fijo
                </label>
              </div>
              {productForm.scoutEarningsMode === 'fixed' && (
                <>
                  <label style={{ display: 'block', marginBottom: 8 }}>Monto de ganancia personal por unidad</label>
                  <input type="number" min={0} step="0.01" value={productForm.scoutEarningsAmount || ''} onChange={(e) => setProductForm((f) => ({ ...f, scoutEarningsAmount: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                </>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>{editingProductId ? 'Guardar' : 'Agregar'}</button>
                <button type="button" onClick={() => { setProductModal(false); setEditingProductId(null); }} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {raffleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setRaffleModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Nueva rifa</h3>
            <form onSubmit={addRaffle}>
              <label style={{ display: 'block', marginBottom: 8 }}>Nombre</label>
              <input required value={raffleForm.name} onChange={(e) => setRaffleForm((f) => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} placeholder="ej. Rifa 2024" />
              <label style={{ display: 'block', marginBottom: 8 }}>Precio por número</label>
              <input type="number" required min={0} step="0.01" value={raffleForm.pricePerNumber || ''} onChange={(e) => setRaffleForm((f) => ({ ...f, pricePerNumber: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Cantidad de números</label>
              <input type="number" required min={1} value={raffleForm.totalNumbers || ''} onChange={(e) => setRaffleForm((f) => ({ ...f, totalNumbers: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Ganancia personal del scout por número vendido</label>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                  <input type="radio" name="scoutEarnings" checked={raffleForm.scoutEarningsMode === 'total'} onChange={() => setRaffleForm((f) => ({ ...f, scoutEarningsMode: 'total' }))} />
                  <span>Total (cada scout se queda con el precio del número)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="radio" name="scoutEarnings" checked={raffleForm.scoutEarningsMode === 'fixed'} onChange={() => setRaffleForm((f) => ({ ...f, scoutEarningsMode: 'fixed' }))} />
                  <span>Monto fijo por número:</span>
                  <input type="number" min={0} step="0.01" value={raffleForm.scoutEarningsAmount || ''} onChange={(e) => setRaffleForm((f) => ({ ...f, scoutEarningsAmount: Number(e.target.value) || 0 }))} style={{ width: 100, padding: '0.35rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Crear rifa</button>
                <button type="button" onClick={() => setRaffleModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {eventEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setEventEditModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Editar evento</h3>
            <form onSubmit={saveEvent}>
              <label style={{ display: 'block', marginBottom: 8 }}>Nombre</label>
              <input required value={eventForm.name} onChange={(e) => setEventForm((f) => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Tipo</label>
              <select value={eventForm.type} onChange={(e) => setEventForm((f) => ({ ...f, type: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}>
                <option value="venta_empanadas">Venta de empanadas</option>
                <option value="venta_pizzas">Venta de pizzas</option>
                <option value="rifa">Rifa</option>
                <option value="feria">Feria</option>
                <option value="venta_solidaria">Venta solidaria</option>
              </select>
              <label style={{ display: 'block', marginBottom: 8 }}>Fecha</label>
              <input type="date" required value={eventForm.date} onChange={(e) => setEventForm((f) => ({ ...f, date: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Proyecto</label>
              <select required value={eventForm.projectId} onChange={(e) => setEventForm((f) => ({ ...f, projectId: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}>
                <option value="">Seleccionar</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <label style={{ display: 'block', marginBottom: 8 }}>Ingresos</label>
              <input type="number" min={0} value={eventForm.income || ''} onChange={(e) => setEventForm((f) => ({ ...f, income: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Gastos</label>
              <input type="number" min={0} value={eventForm.expenses || ''} onChange={(e) => setEventForm((f) => ({ ...f, expenses: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Guardar</button>
                <button type="button" onClick={() => setEventEditModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
