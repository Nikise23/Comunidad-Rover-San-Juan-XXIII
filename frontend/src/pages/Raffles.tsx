import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rafflesApi, eventsApi, beneficiariesApi } from '../api/client';
import type { Raffle, RaffleNumber, RaffleNumberStatus, RaffleSummary } from '../api/client';

const STATUS_COLOR: Record<string, string> = {
  disponible: 'var(--success)',
  asignado: '#eab308',
  reservado: '#f97316',
  vendido: '#dc2626',
  no_vendido: 'var(--danger)',
};
const STATUS_LABEL: Record<string, string> = {
  disponible: 'Disponible',
  asignado: 'Asignado',
  reservado: 'Reservado',
  vendido: 'Vendido',
  no_vendido: 'No vendido',
};

const btn = { padding: '0.35rem 0.65rem', border: 'none', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' as const };
const btnEdit = { ...btn, background: 'var(--surface-hover)', color: 'var(--text)' };
const btnDanger = { ...btn, background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)' };
const COLS = 10;

type BulkStatusForm = {
  ranges: string;
  status: RaffleNumberStatus;
  soldTo: string;
};

export default function Raffles() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raffleId = searchParams.get('raffle');
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null);
  const [summary, setSummary] = useState<RaffleSummary | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [assignModal, setAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ number: 0, beneficiaryId: '' });
  const [rangesModal, setRangesModal] = useState(false);
  const [rangesForm, setRangesForm] = useState({ beneficiaryId: '', ranges: '' });
  const [blocksModal, setBlocksModal] = useState(false);
  const [blocksForm, setBlocksForm] = useState({ beneficiaryIds: [] as string[], numbersPerBlock: 10 });
  const [continuousModal, setContinuousModal] = useState(false);
  const [continuousForm, setContinuousForm] = useState<{ beneficiaryId: string; count: number }[]>([]);
  const [randomModal, setRandomModal] = useState(false);
  const [randomForm, setRandomForm] = useState({ beneficiaryIds: [] as string[] });
  const [bulkStatusModal, setBulkStatusModal] = useState(false);
  const [bulkStatusForm, setBulkStatusForm] = useState<BulkStatusForm>({ ranges: '', status: 'vendido', soldTo: '' });
  const [bulkStatusError, setBulkStatusError] = useState('');
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false);
  const [numberEditModal, setNumberEditModal] = useState<{ number: RaffleNumber } | null>(null);
  const [numberEditForm, setNumberEditForm] = useState<{ status: RaffleNumberStatus; soldTo: string }>({ status: 'vendido', soldTo: '' });
  const [drawModal, setDrawModal] = useState(false);
  const [drawCount, setDrawCount] = useState(1);
  const [drawResult, setDrawResult] = useState<{ number: number; soldTo: string | null; beneficiaryName: string }[] | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', pricePerNumber: 0, totalNumbers: 0, scoutEarningsMode: 'total' as 'total' | 'fixed', scoutEarningsAmount: 0 });

  const load = () => {
    rafflesApi.list().then((res) => setRaffles(res.data)).catch(() => setRaffles([]));
    beneficiariesApi.list().then((res) => setBeneficiaries(res.data)).catch(() => setBeneficiaries([]));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!raffleId) {
      setSelectedRaffle(null);
      setSummary(null);
      return;
    }
    rafflesApi.get(raffleId).then((res) => setSelectedRaffle(res.data)).catch(() => setSelectedRaffle(null));
    rafflesApi.getSummary(raffleId).then((res) => setSummary(res.data)).catch(() => setSummary(null));
  }, [raffleId]);

  const refresh = () => {
    if (raffleId) {
      rafflesApi.get(raffleId).then((r) => setSelectedRaffle(r.data));
      rafflesApi.getSummary(raffleId).then((r) => setSummary(r.data));
    }
    rafflesApi.list().then((r) => setRaffles(r.data));
  };

  const doAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!raffleId || !assignForm.number) return;
    rafflesApi.assignNumber(raffleId, { number: assignForm.number, beneficiaryId: assignForm.beneficiaryId || undefined }).then(() => {
      setAssignModal(false);
      setAssignForm({ number: 0, beneficiaryId: '' });
      refresh();
    });
  };

  const doRangesAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!raffleId || !rangesForm.beneficiaryId || !rangesForm.ranges.trim()) return;
    rafflesApi.assignByRanges(raffleId, { beneficiaryId: rangesForm.beneficiaryId, ranges: rangesForm.ranges }).then(() => {
      setRangesModal(false);
      setRangesForm({ beneficiaryId: '', ranges: '' });
      refresh();
    });
  };

  const doBlocks = (e: React.FormEvent) => {
    e.preventDefault();
    if (!raffleId || blocksForm.beneficiaryIds.length === 0) return;
    rafflesApi.assignByBlocks(raffleId, { beneficiaryIds: blocksForm.beneficiaryIds, numbersPerBlock: blocksForm.numbersPerBlock || undefined }).then(() => {
      setBlocksModal(false);
      setBlocksForm({ beneficiaryIds: [], numbersPerBlock: 10 });
      refresh();
    });
  };

  const doContinuous = (e: React.FormEvent) => {
    e.preventDefault();
    if (!raffleId || continuousForm.every((a) => a.count <= 0)) return;
    rafflesApi.assignContinuous(raffleId, { assignments: continuousForm.filter((a) => a.beneficiaryId && a.count > 0) }).then(() => {
      setContinuousModal(false);
      setContinuousForm([]);
      refresh();
    });
  };

  const doRandom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!raffleId || randomForm.beneficiaryIds.length === 0) return;
    rafflesApi.assignRandom(raffleId, { beneficiaryIds: randomForm.beneficiaryIds }).then(() => {
      setRandomModal(false);
      setRandomForm({ beneficiaryIds: [] });
      refresh();
    });
  };

  const doBulkStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!raffleId || !bulkStatusForm.ranges.trim()) return;
    setBulkStatusError('');
    setBulkStatusLoading(true);
    const payload = { ranges: bulkStatusForm.ranges, status: bulkStatusForm.status };
    if (bulkStatusForm.status === 'vendido' && bulkStatusForm.soldTo.trim()) payload.soldTo = bulkStatusForm.soldTo.trim();
    rafflesApi
      .setBulkStatus(raffleId, payload)
      .then((res) => {
        const updated = res.data?.updated ?? 0;
        setBulkStatusModal(false);
        setBulkStatusForm({ ranges: '', status: 'vendido', soldTo: '' });
        setBulkStatusError('');
        refresh();
        if (updated > 0) alert(`Se actualizaron ${updated} número(s).`);
      })
      .catch((err: { response?: { data?: { message?: string | string[] }; status?: number }; message?: string }) => {
        const raw = err.response?.data?.message;
        const msg = Array.isArray(raw) ? raw.join(', ') : (raw ?? err.message ?? 'Error al aplicar el estado');
        setBulkStatusError(msg);
      })
      .finally(() => setBulkStatusLoading(false));
  };

  const doReleaseUnsold = () => {
    if (!raffleId) return;
    if (!window.confirm('¿Liberar todos los números no vendidos (asignados/reservados/no vendidos) a disponibles?')) return;
    rafflesApi.releaseUnsold(raffleId).then(() => refresh());
  };

  const openNumberEdit = (n: RaffleNumber) => {
    setNumberEditModal({ number: n });
    setNumberEditForm({ status: n.status, soldTo: (n as any).soldTo ?? '' });
  };

  const doNumberEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!raffleId || !numberEditModal) return;
    rafflesApi.setNumberStatus(raffleId, numberEditModal.number.number, { status: numberEditForm.status, soldTo: numberEditForm.soldTo.trim() || undefined }).then(() => {
      setNumberEditModal(null);
      refresh();
    });
  };

  const doExportCsv = () => {
    if (!raffleId) return;
    rafflesApi.exportCsv(raffleId).then((res) => {
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rifa-${raffleId.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }).catch(() => alert('Error al exportar'));
  };

  const doDraw = () => {
    if (!raffleId || drawCount < 1) return;
    rafflesApi.draw(raffleId, drawCount).then((res) => {
      setDrawResult(res.data.winners);
    }).catch((err) => alert(err.response?.data?.message ?? 'Error al realizar el sorteo'));
  };

  const openEditRaffle = () => {
    if (!selectedRaffle) return;
    const v = selectedRaffle.scoutEarningsPerNumber;
    const mode = v != null ? 'fixed' : 'total';
    setEditForm({
      name: selectedRaffle.name,
      pricePerNumber: Number(selectedRaffle.pricePerNumber) || 0,
      totalNumbers: selectedRaffle.totalNumbers || 0,
      scoutEarningsMode: mode,
      scoutEarningsAmount: mode === 'fixed' ? Number(v) : 0,
    });
    setEditModal(true);
  };

  const saveRaffle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!raffleId) return;
    const scoutEarningsPerNumber = editForm.scoutEarningsMode === 'total' ? null : editForm.scoutEarningsAmount;
    rafflesApi.update(raffleId, { name: editForm.name, pricePerNumber: editForm.pricePerNumber, totalNumbers: editForm.totalNumbers, scoutEarningsPerNumber }).then(() => {
      setEditModal(false);
      refresh();
    });
  };

  const deleteRaffle = () => {
    if (!raffleId || !selectedRaffle) return;
    if (!window.confirm(`¿Eliminar la rifa "${selectedRaffle.name}"?`)) return;
    rafflesApi.delete(raffleId).then(() => {
      setSearchParams({});
      setSelectedRaffle(null);
      setSummary(null);
      load();
    });
  };

  const numbers = (selectedRaffle?.numbers || []) as RaffleNumber[];
  const sortedNumbers = [...numbers].sort((a, b) => a.number - b.number);

  return (
    <div className="page-container">
      <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>Rifas</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          className="touch-target"
          value={raffleId || ''}
          onChange={(e) => {
            const v = e.target.value;
            setSearchParams(v ? { raffle: v } : {});
            setSelectedRaffle(null);
            setSummary(null);
          }}
          style={{ padding: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', minWidth: 220 }}
        >
          <option value="">Seleccionar rifa</option>
          {raffles.map((r) => <option key={r.id} value={r.id}>{r.name} ({(r as any).event?.name})</option>)}
        </select>
        {selectedRaffle && (
          <>
            <button type="button" style={btnEdit} onClick={openEditRaffle}>Editar rifa</button>
            <button type="button" style={btnDanger} onClick={deleteRaffle}>Eliminar rifa</button>
          </>
        )}
      </div>

      {summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{summary.total}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: STATUS_COLOR.disponible }}>{summary.available}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Disponibles</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: STATUS_COLOR.asignado }}>{summary.assigned}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Asignados</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: STATUS_COLOR.reservado }}>{summary.reserved}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reservados</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: STATUS_COLOR.vendido }}>{summary.sold}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vendidos</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: STATUS_COLOR.no_vendido }}>{summary.notSold}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No vendidos</div>
            </div>
          </div>

          {summary.byBeneficiary && summary.byBeneficiary.length > 0 && (
            <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Por protagonista</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {summary.byBeneficiary.map((b) => (
                  <div key={b.beneficiaryId} style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{b.fullName}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Asignados: {b.assigned} · Vendidos: {b.sold} · Restantes: {b.remaining}
                    </div>
                    <div style={{ fontSize: '0.9rem', marginTop: 4, color: 'var(--success)' }}>Recaudado: ${b.moneyCollected.toLocaleString()}</div>
                    <div style={{ fontSize: '0.85rem', marginTop: 2, color: 'var(--text-muted)' }}>Ganancia personal: ${(b.scoutEarnings ?? 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '1rem' }}>
            <button type="button" onClick={() => setAssignModal(true)} style={{ ...btn, background: 'var(--accent)', color: '#000' }}>Asignar número</button>
            <button type="button" onClick={() => setRangesModal(true)} style={btnEdit}>Asignar por rangos (ej. 1-10, 15, 20-25)</button>
            <button type="button" onClick={() => { setBlocksModal(true); setBlocksForm({ beneficiaryIds: [], numbersPerBlock: summary ? Math.max(1, Math.floor(summary.total / (beneficiaries.length || 1))) : 10 }); }} style={btnEdit}>Asignar por bloques</button>
            <button type="button" onClick={() => { setContinuousModal(true); setContinuousForm([{ beneficiaryId: beneficiaries[0]?.id || '', count: 0 }]); }} style={btnEdit}>Distribución continua</button>
            <button type="button" onClick={() => { setRandomModal(true); setRandomForm({ beneficiaryIds: [] }); }} style={btnEdit}>Distribución aleatoria</button>
            <button type="button" onClick={() => { setBulkStatusError(''); setBulkStatusModal(true); }} style={btnEdit}>Marcar estado (varios números)</button>
            <button type="button" onClick={doReleaseUnsold} style={{ ...btn, background: 'var(--surface-hover)', color: 'var(--text)' }}>Liberar no vendidos</button>
            <button type="button" onClick={doExportCsv} style={btnEdit}>Exportar CSV</button>
            <button type="button" onClick={() => { setDrawModal(true); setDrawResult(null); setDrawCount(1); }} style={{ ...btn, background: 'var(--accent)', color: '#000' }}>Realizar sorteo</button>
          </div>
        </>
      )}

      {selectedRaffle && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
          <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Números</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            🟢 Disponible · 🟡 Asignado · 🟠 Reservado · 🔴 Vendido · ⬜ No vendido · Clic para editar estado/comprador
          </p>
          <div className="raffle-numbers-grid">
            {sortedNumbers.map((n) => {
              const beneficiary = (n as any).beneficiary;
              const soldTo = (n as any).soldTo;
              const tooltip = `${n.number} - ${STATUS_LABEL[n.status] || n.status}${beneficiary ? ' · ' + beneficiary.firstName + ' ' + beneficiary.lastName : ''}${soldTo ? ' · Comprador: ' + soldTo : ''}`;
              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openNumberEdit(n)}
                  onKeyDown={(e) => e.key === 'Enter' && openNumberEdit(n)}
                  style={{
                    aspectRatio: '1',
                    maxWidth: 44,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: STATUS_COLOR[n.status] || 'var(--border)',
                    color: n.status === 'vendido' ? '#fff' : 'var(--text)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                  title={tooltip}
                >
                  {n.number}
                </div>
              );
            })}
          </div>
          {sortedNumbers.length > 0 && (
            <p style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Total: {sortedNumbers.length} números
            </p>
          )}
        </div>
      )}

      {assignModal && selectedRaffle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setAssignModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Asignar número</h3>
            <form onSubmit={doAssign}>
              <label style={{ display: 'block', marginBottom: 8 }}>Número</label>
              <input type="number" required min={1} max={selectedRaffle.totalNumbers} value={assignForm.number || ''} onChange={(e) => setAssignForm((f) => ({ ...f, number: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Protagonista</label>
              <select value={assignForm.beneficiaryId} onChange={(e) => setAssignForm((f) => ({ ...f, beneficiaryId: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}>
                <option value="">Sin asignar</option>
                {beneficiaries.map((b) => <option key={b.id} value={b.id}>{b.firstName} {b.lastName}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Asignar</button>
                <button type="button" onClick={() => setAssignModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rangesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setRangesModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Asignar por rangos</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 10 }}>Ejemplos: 1-10 · 15 · 20-25 · 1-10, 15, 20-25</p>
            <form onSubmit={doRangesAssign}>
              <label style={{ display: 'block', marginBottom: 8 }}>Protagonista</label>
              <select required value={rangesForm.beneficiaryId} onChange={(e) => setRangesForm((f) => ({ ...f, beneficiaryId: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}>
                <option value="">Seleccionar</option>
                {beneficiaries.map((b) => <option key={b.id} value={b.id}>{b.firstName} {b.lastName}</option>)}
              </select>
              <label style={{ display: 'block', marginBottom: 8 }}>Números o rangos</label>
              <input value={rangesForm.ranges} onChange={(e) => setRangesForm((f) => ({ ...f, ranges: e.target.value }))} placeholder="1-10, 15, 20-25" style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Asignar</button>
                <button type="button" onClick={() => setRangesModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {blocksModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setBlocksModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', maxHeight: '90vh', overflow: 'auto', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Asignar por bloques</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 10 }}>Orden: primeros N números al 1º, siguientes N al 2º, etc.</p>
            <form onSubmit={doBlocks}>
              <label style={{ display: 'block', marginBottom: 8 }}>Números por bloque (opcional)</label>
              <input type="number" min={1} value={blocksForm.numbersPerBlock || ''} onChange={(e) => setBlocksForm((f) => ({ ...f, numbersPerBlock: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} placeholder="Ej. 10" />
              <label style={{ display: 'block', marginBottom: 8 }}>Protagonistas (orden)</label>
              <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                {beneficiaries.map((b) => (
                  <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={blocksForm.beneficiaryIds.includes(b.id)} onChange={(e) => {
                      if (e.target.checked) setBlocksForm((f) => ({ ...f, beneficiaryIds: [...f.beneficiaryIds, b.id] }));
                      else setBlocksForm((f) => ({ ...f, beneficiaryIds: f.beneficiaryIds.filter((id) => id !== b.id) }));
                    }} />
                    <span>{b.firstName} {b.lastName}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Asignar</button>
                <button type="button" onClick={() => setBlocksModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {continuousModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setContinuousModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', maxHeight: '90vh', overflow: 'auto', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Distribución continua</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 10 }}>Asignar rangos consecutivos: 1º recibe X números, 2º recibe Y, etc.</p>
            <form onSubmit={doContinuous}>
              {continuousForm.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                  <select value={a.beneficiaryId} onChange={(e) => setContinuousForm((f) => f.map((x, j) => j === i ? { ...x, beneficiaryId: e.target.value } : x))} style={{ flex: 1, padding: '0.5rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}>
                    <option value="">Protagonista</option>
                    {beneficiaries.map((b) => <option key={b.id} value={b.id}>{b.firstName} {b.lastName}</option>)}
                  </select>
                  <input type="number" min={0} placeholder="Cant." value={a.count || ''} onChange={(e) => setContinuousForm((f) => f.map((x, j) => j === i ? { ...x, count: Number(e.target.value) || 0 } : x))} style={{ width: 80, padding: '0.5rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                </div>
              ))}
              <button type="button" onClick={() => setContinuousForm((f) => [...f, { beneficiaryId: '', count: 0 }])} style={{ fontSize: '0.85rem', marginBottom: 10 }}>+ Agregar fila</button>
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Asignar</button>
                <button type="button" onClick={() => setContinuousModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {randomModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setRandomModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', maxHeight: '90vh', overflow: 'auto', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Distribución aleatoria</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 10 }}>Repartir números disponibles en partes iguales al azar entre los seleccionados.</p>
            <form onSubmit={doRandom}>
              <label style={{ display: 'block', marginBottom: 8 }}>Protagonistas</label>
              <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                {beneficiaries.map((b) => (
                  <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={randomForm.beneficiaryIds.includes(b.id)} onChange={(e) => {
                      if (e.target.checked) setRandomForm((f) => ({ ...f, beneficiaryIds: [...f.beneficiaryIds, b.id] }));
                      else setRandomForm((f) => ({ ...f, beneficiaryIds: f.beneficiaryIds.filter((id) => id !== b.id) }));
                    }} />
                    <span>{b.firstName} {b.lastName}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Repartir</button>
                <button type="button" onClick={() => setRandomModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bulkStatusModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setBulkStatusModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Marcar estado (varios números)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 10 }}>Ejemplos: 3, 4, 5 · 10-15 · 1-10, 20, 25-30</p>
            <form onSubmit={doBulkStatus}>
              <label style={{ display: 'block', marginBottom: 8 }}>Números o rangos</label>
              <input value={bulkStatusForm.ranges} onChange={(e) => setBulkStatusForm((f) => ({ ...f, ranges: e.target.value }))} placeholder="1-10, 15, 20-25" style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Estado</label>
              <select value={bulkStatusForm.status} onChange={(e) => setBulkStatusForm((f) => ({ ...f, status: e.target.value as RaffleNumberStatus }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}>
                <option value="disponible">Disponible</option>
                <option value="asignado">Asignado</option>
                <option value="reservado">Reservado</option>
                <option value="vendido">Vendido</option>
                <option value="no_vendido">No vendido</option>
              </select>
              {bulkStatusForm.status === 'vendido' && (
                <>
                  <label style={{ display: 'block', marginBottom: 8 }}>Nombre del comprador (opcional)</label>
                  <input value={bulkStatusForm.soldTo} onChange={(e) => setBulkStatusForm((f) => ({ ...f, soldTo: e.target.value }))} placeholder="Ej. Juan Pérez" style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                </>
              )}
              {bulkStatusError && <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: 8 }}>{bulkStatusError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button type="submit" disabled={bulkStatusLoading} style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, opacity: bulkStatusLoading ? 0.7 : 1 }}>{bulkStatusLoading ? 'Aplicando…' : 'Aplicar'}</button>
                <button type="button" disabled={bulkStatusLoading} onClick={() => setBulkStatusModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {numberEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setNumberEditModal(null)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Número {numberEditModal.number.number}</h3>
            <form onSubmit={doNumberEdit}>
              <label style={{ display: 'block', marginBottom: 8 }}>Estado</label>
              <select value={numberEditForm.status} onChange={(e) => setNumberEditForm((f) => ({ ...f, status: e.target.value as RaffleNumberStatus }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}>
                <option value="disponible">Disponible</option>
                <option value="asignado">Asignado</option>
                <option value="reservado">Reservado</option>
                <option value="vendido">Vendido</option>
                <option value="no_vendido">No vendido</option>
              </select>
              {numberEditForm.status === 'vendido' && (
                <>
                  <label style={{ display: 'block', marginBottom: 8 }}>Nombre del comprador</label>
                  <input value={numberEditForm.soldTo} onChange={(e) => setNumberEditForm((f) => ({ ...f, soldTo: e.target.value }))} placeholder="Ej. Juan Pérez" style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                </>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Guardar</button>
                <button type="button" onClick={() => setNumberEditModal(null)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {drawModal && selectedRaffle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setDrawModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', maxHeight: '90vh', overflow: 'auto', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Realizar sorteo</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>Se elegirán ganadores al azar entre los números vendidos.</p>
            {!drawResult ? (
              <>
                <label style={{ display: 'block', marginBottom: 8 }}>Cantidad de ganadores</label>
                <input type="number" min={1} max={summary?.sold ?? 100} value={drawCount} onChange={(e) => setDrawCount(Math.max(1, parseInt(e.target.value, 10) || 1))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                  <button type="button" onClick={doDraw} style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Sortear</button>
                  <button type="button" onClick={() => setDrawModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cerrar</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>Ganadores:</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {drawResult.map((w, i) => (
                    <li key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                      <strong>Nº {w.number}</strong>
                      {w.soldTo ? ` · Comprador: ${w.soldTo}` : ''}
                      {w.beneficiaryName ? ` · Scout: ${w.beneficiaryName}` : ''}
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                  <button type="button" onClick={() => { setDrawResult(null); }} style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Sortear de nuevo</button>
                  <button type="button" onClick={() => setDrawModal(false)} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cerrar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setEditModal(false)}>
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Editar rifa</h3>
            <form onSubmit={saveRaffle}>
              <label style={{ display: 'block', marginBottom: 8 }}>Nombre</label>
              <input required value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Precio por número</label>
              <input type="number" required min={0} step="0.01" value={editForm.pricePerNumber || ''} onChange={(e) => setEditForm((f) => ({ ...f, pricePerNumber: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Cantidad de números</label>
              <input type="number" required min={1} value={editForm.totalNumbers || ''} onChange={(e) => setEditForm((f) => ({ ...f, totalNumbers: Number(e.target.value) || 0 }))} style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
              <label style={{ display: 'block', marginBottom: 8 }}>Ganancia personal del scout por número vendido</label>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                  <input type="radio" name="editScoutEarnings" checked={editForm.scoutEarningsMode === 'total'} onChange={() => setEditForm((f) => ({ ...f, scoutEarningsMode: 'total' }))} />
                  <span>Total (precio del número)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="radio" name="editScoutEarnings" checked={editForm.scoutEarningsMode === 'fixed'} onChange={() => setEditForm((f) => ({ ...f, scoutEarningsMode: 'fixed' }))} />
                  <span>Monto fijo:</span>
                  <input type="number" min={0} step="0.01" value={editForm.scoutEarningsAmount || ''} onChange={(e) => setEditForm((f) => ({ ...f, scoutEarningsAmount: Number(e.target.value) || 0 }))} style={{ width: 100, padding: '0.35rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} />
                </label>
              </div>
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
