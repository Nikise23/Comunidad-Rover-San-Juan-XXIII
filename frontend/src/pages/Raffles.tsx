import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { rafflesApi, eventsApi, beneficiariesApi } from '../api/client';
import type { Raffle, RaffleNumber, RaffleNumberStatus, RaffleSummary } from '../api/client';
import ConfettiCanvas from '../components/ConfettiCanvas';
import './Raffles.css';

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

function formatImportCsvError(err: unknown): string {
  const e = err as { response?: { data?: { message?: unknown } }; message?: string };
  const raw = e.response?.data?.message;
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string').join('\n');
  if (typeof raw === 'string') return raw;
  if (typeof e.message === 'string' && e.message.length > 0) return e.message;
  return 'No se pudo importar el CSV.';
}

/** Etiqueta de puesto para resultados del sorteo (rank 1-based). */
function drawPlaceLabel(rank: number): string {
  if (rank === 1) return '1er premio';
  if (rank === 2) return '2do puesto';
  if (rank === 3) return '3er puesto';
  if (rank === 4) return '4to puesto';
  if (rank === 5) return '5to puesto';
  if (rank === 6) return '6to puesto';
  if (rank === 7) return '7mo puesto';
  if (rank === 8) return '8vo puesto';
  if (rank === 9) return '9no puesto';
  if (rank === 10) return '10mo puesto';
  return `${rank}º puesto`;
}

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
  const [drawPhase, setDrawPhase] = useState<'setup' | 'countdown' | 'loading' | 'winners'>('setup');
  const [drawCountdown, setDrawCountdown] = useState(3);
  const [showDrawConfetti, setShowDrawConfetti] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', pricePerNumber: 0, totalNumbers: 0, scoutEarningsMode: 'total' as 'total' | 'fixed', scoutEarningsAmount: 0 });
  const importCsvInputRef = useRef<HTMLInputElement>(null);
  const [importCsvBanner, setImportCsvBanner] = useState<
    null | { type: 'loading'; label: string } | { type: 'ok'; updated: number; secondsTotal: number; secondsUpload: number } | { type: 'err'; message: string }
  >(null);

  const importCsvBusy = importCsvBanner?.type === 'loading';

  const load = () => {
    rafflesApi.list().then((res) => setRaffles(res.data)).catch(() => setRaffles([]));
    beneficiariesApi.list().then((res) => setBeneficiaries(res.data)).catch(() => setBeneficiaries([]));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    setImportCsvBanner(null);
  }, [raffleId]);

  useEffect(() => {
    if (!raffleId) {
      setSelectedRaffle(null);
      setSummary(null);
      return;
    }
    let cancelled = false;
    Promise.all([rafflesApi.get(raffleId), rafflesApi.getSummary(raffleId)])
      .then(([detail, sum]) => {
        if (!cancelled) {
          setSelectedRaffle(detail.data);
          setSummary(sum.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedRaffle(null);
          setSummary(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [raffleId]);

  const refresh = () => {
    if (raffleId) {
      Promise.all([rafflesApi.get(raffleId), rafflesApi.getSummary(raffleId)]).then(([r, s]) => {
        setSelectedRaffle(r.data);
        setSummary(s.data);
      });
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
    const payload: { ranges: string; status: RaffleNumberStatus; soldTo?: string } = {
      ranges: bulkStatusForm.ranges,
      status: bulkStatusForm.status,
    };
    const soldTo = (bulkStatusForm as any).soldTo as string | undefined;
    if (bulkStatusForm.status === 'vendido' && soldTo && soldTo.trim()) {
      payload.soldTo = soldTo.trim();
    }
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

  const onImportCsvPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !raffleId) return;
    const tFileStart = typeof performance !== 'undefined' ? performance.now() : 0;
    setImportCsvBanner({ type: 'loading', label: 'Leyendo el archivo en el navegador…' });
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const tAfterRead = typeof performance !== 'undefined' ? performance.now() : 0;
      const readSeconds = tFileStart > 0 ? (tAfterRead - tFileStart) / 1000 : 0;
      setImportCsvBanner({ type: 'loading', label: 'Enviando al servidor e importando…' });
      const tUploadStart = typeof performance !== 'undefined' ? performance.now() : 0;
      rafflesApi
        .importCsv(raffleId, text)
        .then((res) => {
          const tEnd = typeof performance !== 'undefined' ? performance.now() : 0;
          const uploadSeconds = tUploadStart > 0 ? (tEnd - tUploadStart) / 1000 : 0;
          const totalSeconds = tFileStart > 0 ? (tEnd - tFileStart) / 1000 : uploadSeconds + readSeconds;
          setImportCsvBanner({
            type: 'ok',
            updated: res.data.updated,
            secondsTotal: totalSeconds,
            secondsUpload: uploadSeconds,
          });
          refresh();
        })
        .catch((err: unknown) => {
          setImportCsvBanner({ type: 'err', message: formatImportCsvError(err) });
        });
    };
    reader.onerror = () => {
      setImportCsvBanner({
        type: 'err',
        message: 'No se pudo leer el archivo. Comprobá permisos o que sea un archivo de texto/CSV válido.',
      });
    };
    reader.readAsText(file, 'UTF-8');
  };

  const closeDrawModal = useCallback(() => {
    setDrawModal(false);
    setDrawResult(null);
    setDrawPhase('setup');
    setShowDrawConfetti(false);
    setDrawError(null);
    setDrawCountdown(3);
  }, []);

  const openDrawModal = useCallback(() => {
    setDrawModal(true);
    setDrawResult(null);
    setDrawCount(1);
    setDrawPhase('setup');
    setShowDrawConfetti(false);
    setDrawError(null);
    setDrawCountdown(3);
  }, []);

  useEffect(() => {
    if (drawPhase !== 'countdown') return;
    setDrawCountdown(3);
    let remaining = 3;
    const id = window.setInterval(() => {
      remaining -= 1;
      if (remaining >= 1) {
        setDrawCountdown(remaining);
      } else {
        window.clearInterval(id);
        setDrawPhase('loading');
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [drawPhase]);

  useEffect(() => {
    if (drawPhase !== 'loading' || !raffleId) return;
    let cancelled = false;
    rafflesApi
      .draw(raffleId, drawCount)
      .then((res) => {
        if (cancelled) return;
        setDrawResult(res.data.winners);
        setDrawPhase('winners');
        setShowDrawConfetti(true);
      })
      .catch((err: { response?: { data?: { message?: string } }; message?: string }) => {
        if (cancelled) return;
        setDrawError(err.response?.data?.message ?? err.message ?? 'Error al realizar el sorteo');
        setDrawPhase('setup');
      });
    return () => {
      cancelled = true;
    };
  }, [drawPhase, raffleId, drawCount]);

  const startDraw = () => {
    if (!raffleId || drawCount < 1) return;
    setDrawError(null);
    setShowDrawConfetti(false);
    setDrawResult(null);
    setDrawPhase('countdown');
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
                    {(b.numbers?.length ?? 0) > 0 && (
                      <div
                        title={b.numbers.join(', ')}
                        style={{
                          fontSize: '0.78rem',
                          marginTop: 6,
                          lineHeight: 1.35,
                          color: 'var(--text-muted)',
                          wordBreak: 'break-word',
                          maxHeight: 100,
                          overflowY: 'auto',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary, var(--text-muted))' }}>Números: </span>
                        {b.numbers.join(', ')}
                      </div>
                    )}
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
            <input ref={importCsvInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onImportCsvPick} />
            <button type="button" disabled={importCsvBusy} onClick={() => importCsvInputRef.current?.click()} style={btnEdit}>
              {importCsvBusy ? 'Importando…' : 'Importar CSV'}
            </button>
            <button type="button" onClick={doExportCsv} style={btnEdit}>Exportar CSV</button>
            <button type="button" onClick={openDrawModal} style={{ ...btn, background: 'var(--accent)', color: '#000' }}>Realizar sorteo</button>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 10px', maxWidth: 640, lineHeight: 1.4 }}>
            Solo se pueden actualizar por CSV los cupones que ya existen en la rifa (1…total). Para sumar nuevos números, abrí «Editar rifa» y aumentá la cantidad total.
          </p>
          {importCsvBanner && (
            <div
              role={importCsvBanner.type === 'err' ? 'alert' : 'status'}
              aria-live={importCsvBanner.type === 'err' ? 'assertive' : 'polite'}
              style={{
                marginBottom: '1rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 8,
                fontSize: '0.88rem',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.45,
                border: '1px solid var(--border)',
                ...(importCsvBanner.type === 'loading'
                  ? { background: 'var(--bg)', color: 'var(--text-muted)' }
                  : importCsvBanner.type === 'ok'
                    ? { borderColor: 'var(--success)', background: 'var(--surface)', color: 'var(--text)' }
                    : { borderColor: 'var(--danger)', background: 'var(--surface)', color: 'var(--text)' }),
              }}
            >
              {importCsvBanner.type === 'loading' && <strong style={{ color: 'var(--text)' }}>{importCsvBanner.label}</strong>}
              {importCsvBanner.type === 'ok' && (
                <>
                  <strong style={{ color: 'var(--success)' }}>Importación correcta.</strong>{' '}
                  Se actualizaron {importCsvBanner.updated} número(s). Tiempo total (lectura + red + servidor):{' '}
                  {importCsvBanner.secondsTotal.toFixed(1)} s. Tiempo hasta respuesta del servidor:{' '}
                  {importCsvBanner.secondsUpload.toFixed(1)} s.
                </>
              )}
              {importCsvBanner.type === 'err' && (
                <>
                  <strong style={{ color: 'var(--danger)' }}>No se aplicó la importación.</strong> {importCsvBanner.message}
                </>
              )}
            </div>
          )}
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
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px', marginBottom: 8 }}>
                <label style={{ margin: 0, flex: '1 1 auto' }}>Protagonistas (orden)</label>
                <button
                  type="button"
                  onClick={() => setBlocksForm((f) => ({ ...f, beneficiaryIds: beneficiaries.map((x) => x.id) }))}
                  style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
                >
                  Seleccionar todos
                </button>
                <button
                  type="button"
                  onClick={() => setBlocksForm((f) => ({ ...f, beneficiaryIds: [] }))}
                  style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
                >
                  Ninguno
                </button>
              </div>
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

      {showDrawConfetti && drawModal ? <ConfettiCanvas active={showDrawConfetti} /> : null}

      {drawModal && selectedRaffle && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }}
          onClick={() => {
            if (drawPhase === 'countdown' || drawPhase === 'loading') return;
            closeDrawModal();
          }}
        >
          <div className="modal-content" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', maxHeight: '90vh', overflow: 'auto', maxWidth: 420, minWidth: 280 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>Realizar sorteo</h3>

            {drawPhase === 'countdown' && (
              <div className="draw-countdown-wrap" aria-live="polite">
                <span className="draw-countdown-label">El sorteo comienza en</span>
                <span key={drawCountdown} className="draw-countdown-number">
                  {drawCountdown}
                </span>
              </div>
            )}

            {drawPhase === 'loading' && (
              <div className="draw-loading" aria-busy="true">
                <div className="draw-loading-spinner" />
                <span>Sorteando…</span>
              </div>
            )}

            {drawPhase === 'setup' && (
              <>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>Se elegirán ganadores al azar entre los números vendidos.</p>
                {drawError ? <p style={{ color: 'var(--danger)', fontSize: '0.88rem', marginBottom: 10 }}>{drawError}</p> : null}
                <label style={{ display: 'block', marginBottom: 8 }}>Cantidad de ganadores</label>
                <input
                  type="number"
                  min={1}
                  max={summary?.sold ?? 100}
                  value={drawCount}
                  onChange={(e) => setDrawCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{ width: '100%', padding: '0.5rem', marginBottom: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                  <button type="button" onClick={startDraw} style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}>Sortear</button>
                  <button type="button" onClick={closeDrawModal} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cerrar</button>
                </div>
              </>
            )}

            {drawPhase === 'winners' && drawResult && (
              <>
                <p className="draw-winners-title">¡Ganadores!</p>
                {drawResult[0] && (
                  <div className="draw-winner-first draw-winner-item">
                    <span className="draw-winner-first-badge">1er premio</span>
                    <div className="draw-winner-first-number">Nº {drawResult[0].number}</div>
                    {drawResult[0].soldTo ? (
                      <div className="draw-winner-first-buyer">
                        <span className="draw-winner-first-buyer-label">Comprador</span>
                        <span className="draw-winner-first-buyer-name">{drawResult[0].soldTo}</span>
                      </div>
                    ) : (
                      <p className="draw-winner-first-no-buyer">Sin comprador registrado</p>
                    )}
                    {drawResult[0].beneficiaryName ? (
                      <p className="draw-winner-first-scout">Scout: {drawResult[0].beneficiaryName}</p>
                    ) : null}
                  </div>
                )}
                {drawResult.length > 1 && (
                  <ul className="draw-winners-rest" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {drawResult.slice(1).map((w, idx) => {
                      const rank = idx + 2;
                      return (
                        <li key={rank} className="draw-winner-item draw-winner-other">
                          <span className="draw-winner-place-badge">{drawPlaceLabel(rank)}</span>
                          <div className="draw-winner-other-body">
                            <strong>Nº {w.number}</strong>
                            {w.soldTo ? (
                              <span className="draw-winner-other-buyer">
                                {' '}
                                · Comprador: <strong>{w.soldTo}</strong>
                              </span>
                            ) : null}
                            {w.beneficiaryName ? ` · Scout: ${w.beneficiaryName}` : ''}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawResult(null);
                      setDrawPhase('setup');
                      setShowDrawConfetti(false);
                      setDrawError(null);
                    }}
                    style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600 }}
                  >
                    Sortear de nuevo
                  </button>
                  <button type="button" onClick={closeDrawModal} style={{ padding: '0.5rem 1rem', background: 'var(--surface-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>Cerrar</button>
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
