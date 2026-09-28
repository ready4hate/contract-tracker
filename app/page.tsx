'use client'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { formatMoney, formatDate, isOverdue, isDueSoon, statusLabel } from '@/lib/utils'
import { DirectionBadge } from '@/components/contracts/StatusBadge'
import { ContractStatus } from '@/lib/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO, startOfMonth } from 'date-fns'
import { ru } from 'date-fns/locale'
import { AlertCircle, Clock, XCircle, X, Receipt } from 'lucide-react'

const DIRECTION_YEARS = [2026, 2025, 2024, 2023]

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const items = payload.filter(p => p.value > 0).sort((a, b) => b.value - a.value)
  const total = items.reduce((s, p) => s + p.value, 0)
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 20px -4px rgba(0,0,0,.15)', maxWidth: 280 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map(p => (
          <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--muted-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatMoney(p.value * 1000000)}</span>
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div style={{ borderTop: '1px solid var(--line-soft)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}>
          <span>Итого</span>
          <span>{formatMoney(total * 1000000)}</span>
        </div>
      )}
    </div>
  )
}

// Закреплённая по клику версия — не исчезает при наведении курсора, остаётся открытой пока не закроют крестиком
function PinnedBreakdown({ label, payload, onClose }: { label: string; payload: { id: string; name: string; value: number }[]; onClose: () => void }) {
  const router = useRouter()
  const items = payload.filter(p => p.value > 0).sort((a, b) => b.value - a.value)
  const total = items.reduce((s, p) => s + p.value, 0)
  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 28px -6px rgba(0,0,0,.22)', width: 280 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{label}</span>
        <button onClick={onClose} style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'var(--bg)', color: 'var(--muted-ink)', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <X size={13} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map(p => (
          <div key={p.id} onClick={() => router.push(`/contracts/${p.id}`)}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, cursor: 'pointer', borderRadius: 5, padding: '2px 4px', margin: '0 -4px' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <span style={{ color: 'var(--maf)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatMoney(p.value * 1000000)}</span>
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div style={{ borderTop: '1px solid var(--line-soft)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13 }}>
          <span>Итого</span>
          <span>{formatMoney(total * 1000000)}</span>
        </div>
      )}
    </div>
  )
}

function formatAmountLabel(value: number) {
  if (value < 1) {
    return `${Math.round(value * 1000).toLocaleString('ru-RU')} тыс. ₽`
  }
  const formatted = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, '')
  return `${formatted} млн. ₽`
}

function KpiCard({ label, value, sub, valueColor }: { label: string; value: string | number; sub?: string; valueColor?: string }) {
  return (
    <div className="ct-card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 13, color: 'var(--muted-ink)', fontWeight: 500 }}>{label}</div>
      <div className="tnum" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', margin: '8px 0 6px', color: valueColor || 'var(--ink)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { contracts, objects, counterparties, payments, initSeed } = useStore()
  useEffect(() => { initSeed() }, [])

  const [pinned, setPinned] = useState<{ label: string; payload: { id: string; name: string; value: number }[] } | null>(null)

  const enriched = useMemo(() => contracts.map((c) => ({
    ...c,
    status: isOverdue(c.endDate, c.status, c.paymentStatus) ? 'overdue' as ContractStatus : c.status,
  })), [contracts])

  const totalAmount = enriched.reduce((s, c) => s + c.amount, 0)
  const totalPaid   = enriched.reduce((s, c) => s + c.amountPaid, 0)
  const currentYear = new Date().getFullYear()
  const paidCurrentYear = payments
    .filter(p => p.paidAt && new Date(p.paidAt).getFullYear() === currentYear)
    .reduce((s, p) => s + p.amount, 0)
  const activeCount    = enriched.filter((c) => c.status === 'active').length
  const overdueCount   = enriched.filter((c) => c.status === 'overdue').length
  const completedCount = enriched.filter((c) => c.status === 'completed').length

  const mafTotal      = enriched.filter((c) => c.direction === 'maf').reduce((s, c) => s + c.amount, 0)
  const finishingTotal = enriched.filter((c) => c.direction === 'finishing').reduce((s, c) => s + c.amount, 0)

  const overdue = enriched.filter((c) => c.status === 'overdue')
  const dueSoon = enriched.filter((c) => isDueSoon(c.endDate, c.status))

  const recentPayments = useMemo(() =>
    [...payments]
      .filter(p => p.paidAt)
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      .slice(0, 10)
      .map(p => ({ payment: p, contract: contracts.find(c => c.id === p.contractId) })),
    [payments, contracts]
  )

  // График истории оплат — стек по контрактам, сгруппированный по месяцам
  const { paymentChartData, paymentContractKeys } = useMemo(() => {
    if (!payments.length) return { paymentChartData: [], paymentContractKeys: [] }

    // Собираем все уникальные контракты из платежей
    const contractIds = [...new Set(payments.map(p => p.contractId))]
    const contractKeys = contractIds.map(id => {
      const c = contracts.find(c => c.id === id)
      return { id, label: c?.number ?? id.slice(0, 8) }
    })

    // Группируем по месяцам
    const map: Record<string, Record<string, number> & { month: string }> = {}
    payments.forEach(p => {
      if (!p.paidAt) return
      const key   = format(startOfMonth(parseISO(p.paidAt)), 'yyyy-MM')
      const label = format(startOfMonth(parseISO(p.paidAt)), 'MMM yyyy', { locale: ru })
      if (!map[key]) map[key] = { month: label } as any
      const contractLabel = contractKeys.find(k => k.id === p.contractId)?.label ?? p.contractId
      map[key][contractLabel] = (map[key][contractLabel] ?? 0) + p.amount / 1000000
    })

    const data = Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
    return { paymentChartData: data, paymentContractKeys: contractKeys }
  }, [payments, contracts])

  return (
    <div className="fade-in ct-page" style={{ padding: '26px 30px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Главная</h1>
        <span style={{ fontSize: 13, color: 'var(--faint)' }}>Обновлено: сегодня</span>
      </div>

      {overdueCount > 0 && (
        <Link href="/contracts?status=overdue" className="ct-alert-banner" style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: 'linear-gradient(90deg, var(--danger-soft), #fff)',
          borderLeft: '4px solid var(--danger)',
          borderRadius: 14, padding: '14px 20px', color: '#8a2424', fontSize: 14,
          textDecoration: 'none', boxShadow: 'var(--card-shadow)',
          transition: 'transform .15s, box-shadow .15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 8px rgba(214,69,69,.06), 0 18px 40px -22px rgba(214,69,69,.4)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--card-shadow)' }}>
          <div className="ct-alert-pulse" style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--danger)', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0 }}>
            <AlertCircle size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--danger)' }}>
              Просрочено {overdueCount} контракт{overdueCount === 1 ? '' : overdueCount < 5 ? 'а' : 'ов'}
            </div>
            <div style={{ fontSize: 12.5, color: '#a35555', marginTop: 1 }}>Требуется внимание — проверьте дедлайны и оплаты</div>
          </div>
          <span style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
            fontWeight: 600, fontSize: 13, color: '#fff', background: 'var(--danger)',
            padding: '8px 16px', borderRadius: 10, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            Смотреть <span className="ct-alert-arrow" style={{ transition: 'transform .15s', display: 'inline-block' }}>→</span>
          </span>
        </Link>
      )}

      {/* KPI */}
      <div className="ct-grid-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(200px, 420px))', gap: 16, justifyContent: 'start' }}>
        {/* Контрактов всего + Активных + Завершённых в одной карточке */}
        <div className="ct-card" style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 13, color: 'var(--muted-ink)', fontWeight: 500 }}>Контрактов всего</div>
          <div className="tnum" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', margin: '8px 0 6px' }}>{enriched.length}</div>
          <div style={{ fontSize: 12.5, color: 'var(--faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link href="/contracts?status=active" style={{ color: 'var(--faint)', textDecoration: 'none', borderRadius: 6, padding: '1px 3px', margin: '-1px -3px', transition: 'background .15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              Активных <b style={{ color: 'var(--muted-ink)' }}>{activeCount}</b>
            </Link>
            <span>·</span>
            <Link href="/contracts?status=completed" style={{ color: 'var(--faint)', textDecoration: 'none', borderRadius: 6, padding: '1px 3px', margin: '-1px -3px', transition: 'background .15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              Завершённых <b style={{ color: 'var(--muted-ink)' }}>{completedCount}</b>
            </Link>
          </div>
        </div>

        {/* Общая сумма */}
        <KpiCard label="Общая сумма" value={formatMoney(totalAmount)} sub={`${enriched.length} контрактов`} />

        <KpiCard label="Оплачено" value={formatMoney(totalPaid)} valueColor="var(--ok)"
          sub={totalAmount > 0 ? `${Math.round(totalPaid / totalAmount * 100)}% от суммы · за ${currentYear} год: ${formatMoney(paidCurrentYear)}` : undefined} />
        <KpiCard label="Остаток"  value={formatMoney(totalAmount - totalPaid)} valueColor="var(--danger)"
          sub={totalAmount > 0 ? `${Math.round((totalAmount - totalPaid) / totalAmount * 100)}% от суммы` : undefined} />
      </div>

      {/* Directions */}
      <div className="ct-grid-direction" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {[
          { id: 'maf', label: 'МАФ / Металлоконструкции', color: 'var(--maf)', total: mafTotal },
          { id: 'finishing', label: 'Отделочные работы', color: 'var(--otd)', total: finishingTotal },
        ].map(({ id, label, color, total }) => {
          const dir = id as 'maf' | 'finishing'
          return (
            <div key={id} className="ct-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 15 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {label}
              </div>
              <div className="tnum" style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '12px 0 4px', letterSpacing: '-0.02em' }}>{formatMoney(total)}</div>
              <div style={{ fontSize: 13, color: 'var(--faint)' }}>
                {enriched.filter(c => c.direction === dir).length} контрактов · {objects.filter(o => o.direction === dir).length} объектов
              </div>
              <div style={{ marginTop: 16, borderTop: '1px solid var(--line-soft)', paddingTop: 12, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(180px, 0.7fr)', gap: 24, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(['active', 'completed', 'planning', 'overdue'] as ContractStatus[]).map((st) => {
                    const cnt = enriched.filter(c => c.direction === dir && c.status === st).length
                    if (!cnt) return null
                    return (
                      <Link key={st} href={`/contracts?direction=${id}&status=${st}`}
                        style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, textDecoration: 'none', borderRadius: 6, padding: '2px 4px', margin: '0 -4px', transition: 'background .15s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <span style={{ color: 'var(--muted-ink)' }}>{statusLabel[st]}</span>
                        <b className="tnum" style={{ color: 'var(--ink)' }}>{cnt}</b>
                      </Link>
                    )
                  })}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 8 }}>Сумма договоров по годам</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {DIRECTION_YEARS.map(year => {
                      const yearTotal = enriched
                        .filter(c => c.direction === dir && Number((c.startDate || c.createdAt)?.slice(0, 4)) === year)
                        .reduce((sum, c) => sum + c.amount, 0)
                      return (
                        <div key={year} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                          <span style={{ color: 'var(--muted-ink)' }}>{year}</span>
                          <b className="tnum" style={{ color: yearTotal > 0 ? 'var(--ink)' : 'var(--faint)', whiteSpace: 'nowrap' }}>
                            {yearTotal > 0 ? formatMoney(yearTotal) : '—'}
                          </b>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* График истории оплат */}
      <div className="ct-card" style={{ padding: '20px 22px', position: 'relative' }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>История оплат по договорам</div>
        <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>млн. ₽ · по дате внесения оплаты · клик по столбцу закрепляет список</div>
        {paymentChartData.length === 0
          ? <div style={{ color: 'var(--faint)', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>Оплат пока нет — добавьте их в карточках контрактов</div>
          : <ResponsiveContainer width="100%" height={240} style={{ marginTop: 16 }}>
              <BarChart data={paymentChartData} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}
                onClick={(state: any) => {
                  // Recharts 3.x убрал activePayload из onClick и отдаёт activeTooltipIndex строкой ("0"), не числом
                  const idx = state?.activeTooltipIndex
                  const row = idx != null ? paymentChartData[idx as any] : undefined
                  if (!row) return
                  const payload = paymentContractKeys
                    .map(k => ({ id: k.id, name: k.label, value: Number((row as any)[k.label]) || 0 }))
                    .filter(p => p.value > 0)
                  if (!payload.length) return
                  setPinned({ label: String((row as any).month ?? state.activeLabel ?? ''), payload })
                }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--faint)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--faint)' }} tickFormatter={v => `${v.toFixed(1)}М`} />
                {!pinned && <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<ChartTooltip />} />}
                {paymentContractKeys.map((k, i) => {
                  const colors = ['#2f6bdc','#e07a1a','#1f8a5b','#e0325f','#9b5de5','#0891b2','#f59e0b','#10b981','#ec4899','#6366f1','#14b8a6','#f97316','#84cc16','#8b5cf6','#ef4444','#06b6d4','#a855f7','#22c55e','#fb923c','#3b82f6']
                  return <Bar key={k.id} dataKey={k.label} name={k.label} stackId="a" fill={colors[i % colors.length]} radius={i === paymentContractKeys.length - 1 ? [4,4,0,0] : [0,0,0,0]} style={{ cursor: 'pointer' }} />
                })}
              </BarChart>
            </ResponsiveContainer>
        }
        {pinned && (
          <div style={{ position: 'absolute', top: 56, right: 24, zIndex: 10 }}>
            <PinnedBreakdown label={pinned.label} payload={pinned.payload} onClose={() => setPinned(null)} />
          </div>
        )}
      </div>

      {/* Последние поступления */}
      <div className="ct-card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 600, fontSize: 14.5, color: 'var(--ok)', marginBottom: 8 }}>
          <Receipt size={18} /> Последние поступления
        </div>
        {recentPayments.length === 0
          ? <div style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 13, padding: '28px 0' }}>Платежей ещё нет</div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {recentPayments.map(({ payment, contract }) => {
                const obj = contract ? objects.find((o) => o.id === contract.objectId) : undefined
                const customer = contract ? counterparties.find((x) => x.id === contract.customerId) : undefined
                return (
                  <Link key={payment.id} href={contract ? `/contracts/${contract.id}` : '#'}
                    style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '11px 13px', borderRadius: 10, border: '1px solid var(--line-soft)', textDecoration: 'none', cursor: contract ? 'pointer' : 'default', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contract?.number ?? '—'}</span>
                      <span className="tnum" style={{ fontWeight: 700, fontSize: 14, color: 'var(--ok)', whiteSpace: 'nowrap', flexShrink: 0 }}>+{formatMoney(payment.amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--faint)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obj?.name}{obj && customer ? ' · ' : ''}{customer?.name}</span>
                      <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{formatDate(payment.paidAt)}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
        }
      </div>

      {/* Panels */}
      <div className="ct-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Overdue */}
        <div className="ct-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 600, fontSize: 14.5, color: 'var(--danger)', marginBottom: 8 }}>
            <XCircle size={18} /> Просроченные контракты
          </div>
          {overdue.length === 0
            ? <div style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 13, padding: '28px 0' }}>Просроченных нет</div>
            : overdue.map((c) => {
                const obj      = objects.find((o) => o.id === c.objectId)
                const customer = counterparties.find((x) => x.id === c.customerId)
                return (
                  <Link key={c.id} href={`/contracts/${c.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '11px 0', borderTop: '1px solid var(--line-soft)', textDecoration: 'none', cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{c.number}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 3 }}>{obj?.name} · {customer?.name}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>
                      до {formatDate(c.endDate)}
                      <div style={{ marginTop: 6 }}><DirectionBadge direction={c.direction} /></div>
                    </div>
                  </Link>
                )
              })
          }
        </div>

        {/* Due soon */}
        <div className="ct-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 600, fontSize: 14.5, color: 'var(--warn)', marginBottom: 8 }}>
            <Clock size={18} /> Заканчиваются в течение 30 дней
          </div>
          {dueSoon.length === 0
            ? <div style={{ textAlign: 'center', color: 'var(--faint)', fontSize: 13, padding: '28px 0' }}>Дедлайнов нет</div>
            : dueSoon.map((c) => {
                const obj      = objects.find((o) => o.id === c.objectId)
                const customer = counterparties.find((x) => x.id === c.customerId)
                return (
                  <Link key={c.id} href={`/contracts/${c.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '11px 0', borderTop: '1px solid var(--line-soft)', textDecoration: 'none' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{c.number}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 3 }}>{obj?.name} · {customer?.name}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12.5, color: 'var(--warn)', whiteSpace: 'nowrap' }}>
                      до {formatDate(c.endDate)}
                      <div style={{ marginTop: 6 }}><DirectionBadge direction={c.direction} /></div>
                    </div>
                  </Link>
                )
              })
          }
        </div>
      </div>
    </div>
  )
}
