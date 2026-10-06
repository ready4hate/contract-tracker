'use client'
import { useEffect, useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { Contract, Direction, ContractStatus, PaymentStatus } from '@/lib/types'
import { formatMoney, formatDate, isOverdue, exportToCsv, statusLabel, paymentLabel, directionLabel } from '@/lib/utils'
import { ContractForm } from '@/components/contracts/ContractForm'
import { StatusBadge, PaymentBadge, DirectionBadge } from '@/components/contracts/StatusBadge'
import { Plus, Search, Pencil, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

const S = {
  card: { background: '#fff', border: '1px solid var(--line)', borderRadius: 16, boxShadow: 'var(--card-shadow)' } as React.CSSProperties,
  btn: (primary?: boolean, dark?: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 15px',
    borderRadius: 10, border: `1px solid ${primary ? '#2f6bdc' : dark ? '#182033' : 'var(--line)'}`,
    background: primary ? '#2f6bdc' : dark ? '#182033' : '#fff',
    color: primary || dark ? '#fff' : 'var(--ink)',
    fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
    boxShadow: primary ? '0 6px 16px -8px #2f6bdc' : 'none',
    whiteSpace: 'nowrap',
  }),
  th: { textAlign: 'left' as const, padding: '12px 10px', color: 'var(--muted-ink)', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' as const, borderBottom: '1px solid var(--line)', cursor: 'pointer', letterSpacing: '-0.01em' },
  td: { padding: '10px 10px', borderBottom: '1px solid var(--line-soft)', verticalAlign: 'middle' as const, fontSize: 13 },
}

export default function ContractsPage() {
  const { contracts, objects, counterparties, deleteContract, initSeed, loadAll, loading } = useStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const objectParam = searchParams.get('object') ?? 'all'
  const statusParam      = searchParams.get('status') ?? 'all'
  const directionParam   = searchParams.get('direction') ?? 'all'
  const paymentParam     = searchParams.get('payment') ?? 'all'
  const customerParam    = searchParams.get('customer') ?? 'all'
  const contractorParam  = searchParams.get('contractor') ?? 'all'
  const searchParam      = searchParams.get('q') ?? ''
  useEffect(() => { initSeed() }, [])

  // Фильтры живут в URL — так они переживают переход на карточку контракта и кнопку "Назад"
  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === 'all') params.delete(key)
    else params.set(key, value)
    const qs = params.toString()
    router.replace(`/contracts${qs ? '?' + qs : ''}`)
  }

  const filterDirection = directionParam as Direction | 'all'
  const filterStatus = statusParam as ContractStatus | 'all'
  const filterPayment = paymentParam as PaymentStatus | 'all'
  const filterCustomer = customerParam
  const filterContractor = contractorParam
  const search = searchParam
  const [sortField, setSortField] = useState<keyof Contract>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Contract | undefined>()
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const customers    = counterparties.filter((c) => c.type === 'customer')
  const contractors  = counterparties.filter((c) => c.type === 'contractor')

  const filtered = useMemo(() => {
    let list = contracts.map((c) => ({ ...c, status: isOverdue(c.endDate, c.status, c.paymentStatus) ? 'overdue' as ContractStatus : c.status }))
    if (objectParam !== 'all')       list = list.filter((c) => c.objectId === objectParam)
    if (filterDirection !== 'all')   list = list.filter((c) => c.direction === filterDirection)
    if (filterStatus !== 'all')      list = list.filter((c) => c.status === filterStatus)
    if (filterPayment !== 'all')     list = list.filter((c) => c.paymentStatus === filterPayment)
    if (filterCustomer !== 'all')    list = list.filter((c) => c.customerId === filterCustomer)
    if (filterContractor !== 'all')  list = list.filter((c) => c.contractorId === filterContractor)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) =>
        c.number.toLowerCase().includes(q) ||
        (counterparties.find((x) => x.id === c.customerId)?.name.toLowerCase().includes(q) ?? false) ||
        (counterparties.find((x) => x.id === c.contractorId)?.name.toLowerCase().includes(q) ?? false) ||
        (objects.find((x) => x.id === c.objectId)?.name.toLowerCase().includes(q) ?? false)
      )
    }
    list.sort((a, b) => {
      const av = a[sortField] ?? '', bv = b[sortField] ?? ''
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      return sortDir === 'asc' ? String(av).localeCompare(String(bv), 'ru') : String(bv).localeCompare(String(av), 'ru')
    })
    return list
  }, [contracts, objectParam, filterDirection, filterStatus, filterPayment, filterCustomer, filterContractor, search, sortField, sortDir, counterparties, objects])

  // Сброс страницы при смене фильтров
  useEffect(() => { setPage(1) }, [objectParam, filterDirection, filterStatus, filterPayment, filterCustomer, filterContractor, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSort(field: keyof Contract) {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function handleExport() {
    const rows = filtered.map((c) => ({
      '№ Контракта': c.number, 'Направление': directionLabel[c.direction],
      'Объект': objects.find((o) => o.id === c.objectId)?.name ?? '',
      'Заказчик': counterparties.find((x) => x.id === c.customerId)?.name ?? '',
      'Исполнитель': counterparties.find((x) => x.id === c.contractorId)?.name ?? '',
      'Сумма (руб.)': c.amount, 'Оплачено (руб.)': c.amountPaid,
      'Начало': c.startDate, 'Окончание': c.endDate,
      'Статус': statusLabel[c.status], 'Оплата': paymentLabel[c.paymentStatus],
    }))
    exportToCsv('contracts.csv', rows)
  }

  const SortArrow = ({ field }: { field: keyof Contract }) => (
    <span style={{ marginLeft: 4, opacity: sortField === field ? 1 : 0.35, fontSize: 10, color: sortField === field ? 'var(--maf)' : undefined }}>
      {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )

  return (
    <div className="fade-in ct-page" style={{ padding: '26px 30px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Контракты</h1>
          {objectParam !== 'all' && (
            <div style={{ marginTop: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--muted-ink)' }}>
                Объект: <b>{objects.find(o => o.id === objectParam)?.name ?? objectParam}</b>
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {loading && <span style={{ fontSize: 13, color: 'var(--faint)' }}>Загрузка...</span>}
          <button style={S.btn(false, true)} onClick={() => { setEditing(undefined); setFormOpen(true) }}><Plus size={16} /> Новый контракт</button>
        </div>
      </div>

      {/* Filters */}
      <div className="ct-filters-row" style={{ ...S.card, padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
          <input
            placeholder="Поиск по №, объекту, контрагенту..."
            value={search} onChange={(e) => updateFilter('q', e.target.value)}
            style={{ width: '100%', padding: '10px 14px 10px 38px', border: '1px solid var(--line)', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, background: '#fff', color: 'var(--ink)', boxSizing: 'border-box' }}
          />
        </div>
        {[
          { value: filterDirection, onChange: (v: string) => updateFilter('direction', v), placeholder: 'Направление', options: [{ v: 'all', l: 'Все направления' }, { v: 'maf', l: 'МАФ / Металл' }, { v: 'finishing', l: 'Отделка' }] },
          { value: filterStatus, onChange: (v: string) => updateFilter('status', v), placeholder: 'Статус', options: [{ v: 'all', l: 'Все статусы' }, { v: 'planning', l: 'Планируется' }, { v: 'active', l: 'Активный' }, { v: 'completed', l: 'Завершён' }, { v: 'paused', l: 'Приостановлен' }, { v: 'overdue', l: 'Просрочен' }, { v: 'cancelled', l: 'Отменён' }] },
          { value: filterPayment, onChange: (v: string) => updateFilter('payment', v), placeholder: 'Оплата', options: [{ v: 'all', l: 'Все варианты оплаты' }, { v: 'paid', l: 'Оплачен' }, { v: 'partial', l: 'Частично оплачен' }, { v: 'not_paid', l: 'Не оплачено' }] },
          { value: filterCustomer, onChange: (v: string) => updateFilter('customer', v), placeholder: 'Заказчик', options: [{ v: 'all', l: 'Все заказчики' }, ...customers.map(c => ({ v: c.id, l: c.name }))] },
          { value: filterContractor, onChange: (v: string) => updateFilter('contractor', v), placeholder: 'Исполнитель', options: [{ v: 'all', l: 'Все исполнители' }, ...contractors.map(c => ({ v: c.id, l: c.name }))] },
        ].map((sel, i) => (
          <select key={i} value={sel.value} onChange={(e) => sel.onChange(e.target.value)}
            style={{ padding: '10px 36px 10px 12px', border: '1px solid var(--line)', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, background: '#fff', color: 'var(--ink)', minWidth: 150 }}>
            {sel.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ))}
        {(search || filterDirection !== 'all' || filterStatus !== 'all' || filterPayment !== 'all' || filterCustomer !== 'all' || filterContractor !== 'all' || objectParam !== 'all') && (
          <button onClick={() => router.replace('/contracts')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 11, border: '1px solid var(--line)', background: '#fff', color: 'var(--muted-ink)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <X size={14} /> Сбросить фильтры
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ ...S.card, overflow: 'hidden' }}>
        <div className="table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1300, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '7%' }} />{/* № */}
              <col style={{ width: '12%' }} />{/* Объект */}
              <col style={{ width: '8%' }} />{/* Направление */}
              <col style={{ width: '12%' }} />{/* Заказчик */}
              <col style={{ width: '12%' }} />{/* Исполнитель */}
              <col style={{ width: '9%' }} />{/* Сумма */}
              <col style={{ width: '9%' }} />{/* Оплачено */}
              <col style={{ width: '8%' }} />{/* Остаток */}
              <col style={{ width: '7%' }} />{/* Окончание */}
              <col style={{ width: '6%' }} />{/* Статус */}
              <col style={{ width: '7%' }} />{/* Оплата */}
              <col style={{ width: '3%' }} />{/* Actions */}
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                <th style={S.th} onClick={() => toggleSort('number')}>№ Контракта <SortArrow field="number" /></th>
                <th style={S.th}>Объект</th>
                <th style={S.th}>Направление</th>
                <th style={S.th}>Заказчик</th>
                <th style={S.th}>Исполнитель</th>
                <th style={S.th} onClick={() => toggleSort('amount')}>Сумма <SortArrow field="amount" /></th>
                <th style={S.th}>Оплачено</th>
                <th style={S.th}>Остаток</th>
                <th style={{ ...S.th }} onClick={() => toggleSort('endDate')}>Окончание <SortArrow field="endDate" /></th>
                <th style={S.th}>Статус</th>
                <th style={S.th}>Оплата</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: '36px 0', color: 'var(--faint)', fontSize: 14 }}>Ничего не найдено</td></tr>
              )}
              {paginated.map((c) => {
                const obj        = objects.find((o) => o.id === c.objectId)
                const customer   = counterparties.find((x) => x.id === c.customerId)
                const contractor = counterparties.find((x) => x.id === c.contractorId)
                const pct = c.amount > 0 ? Math.round((c.amountPaid / c.amount) * 100) : 0
                const progColor = pct >= 100 ? 'var(--ok)' : pct > 0 ? 'var(--maf)' : 'var(--warn)'
                return (
                  <tr key={c.id} style={{ cursor: 'pointer', transition: 'background .12s' }}
                    onClick={() => router.push(`/contracts/${c.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafbfd')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ ...S.td, fontFamily: 'var(--font-ibm-plex-mono)', fontWeight: 600 }}>{c.number}</td>
                    <td style={S.td}>{obj?.name ?? '—'}</td>
                    <td style={{ ...S.td, overflow: 'hidden' }}><DirectionBadge direction={c.direction} /></td>
                    <td style={{ ...S.td, color: 'var(--muted-ink)', overflow: 'hidden' }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer?.name ?? '—'}</div></td>
                    <td style={{ ...S.td, color: 'var(--muted-ink)', overflow: 'hidden' }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contractor?.name ?? '—'}</div></td>
                    <td style={{ ...S.td, fontWeight: 600 }} className="tnum">{formatMoney(c.amount)}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                        <span className="tnum" style={{ fontSize: 12.5 }}>{formatMoney(c.amountPaid)}</span>
                        <div style={{ width: '100%', height: 5, borderRadius: 999, background: '#eceff3', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: progColor, transition: 'width .4s' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ ...S.td, fontWeight: 600, color: c.amount - c.amountPaid > 0 ? 'var(--danger)' : 'var(--ok)' }} className="tnum">
                      {formatMoney(c.amount - c.amountPaid)}
                    </td>
                    <td style={{ ...S.td, color: 'var(--muted-ink)', whiteSpace: 'nowrap' }}>{formatDate(c.endDate)}</td>
                    <td style={{ ...S.td, overflow: 'hidden' }}><StatusBadge status={c.status} /></td>
                    <td style={{ ...S.td, overflow: 'hidden' }}><PaymentBadge status={c.paymentStatus} /></td>
                    <td style={S.td} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setEditing(c); setFormOpen(true) }} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none', color: 'var(--faint)', cursor: 'pointer', display: 'grid', placeItems: 'center' }} title="Редактировать"><Pencil size={15} /></button>
                        <button onClick={() => { if (confirm('Удалить контракт?')) deleteContract(c.id) }} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none', color: 'var(--faint)', cursor: 'pointer', display: 'grid', placeItems: 'center' }} title="Удалить"
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--danger-soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--danger)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--faint)' }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ padding: '13px 14px', borderTop: '1px solid var(--line)', fontSize: 13, color: 'var(--muted-ink)' }}>
                  Найдено: <b>{filtered.length}</b> контрактов
                </td>
                <td style={{ padding: '13px 6px', borderTop: '1px solid var(--line)', fontWeight: 700, fontSize: 12, overflow: 'hidden', whiteSpace: 'nowrap' }} className="tnum">
                  {formatMoney(filtered.reduce((s, c) => s + c.amount, 0))}
                </td>
                <td style={{ padding: '13px 6px', borderTop: '1px solid var(--line)', fontWeight: 700, fontSize: 12, color: 'var(--ok)', overflow: 'hidden', whiteSpace: 'nowrap' }} className="tnum">
                  {formatMoney(filtered.reduce((s, c) => s + c.amountPaid, 0))}
                </td>
                <td style={{ padding: '13px 6px', borderTop: '1px solid var(--line)', fontWeight: 700, fontSize: 12, color: 'var(--danger)', overflow: 'hidden', whiteSpace: 'nowrap' }} className="tnum">
                  {formatMoney(filtered.reduce((s, c) => s + (c.amount - c.amountPaid), 0))}
                </td>
                <td colSpan={4} style={{ borderTop: '1px solid var(--line)', padding: '13px 14px' }}>
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--line)', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--faint)' : 'var(--ink)', fontFamily: 'inherit', fontSize: 14 }}>‹</button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setPage(p)}
                          style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--line)', background: p === page ? '#2f6bdc' : '#fff', color: p === page ? '#fff' : 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: p === page ? 700 : 400 }}>
                          {p}
                        </button>
                      ))}
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--line)', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--faint)' : 'var(--ink)', fontFamily: 'inherit', fontSize: 14 }}>›</button>
                    </div>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <ContractForm open={formOpen} onClose={() => setFormOpen(false)} initial={editing} />
    </div>
  )
}
