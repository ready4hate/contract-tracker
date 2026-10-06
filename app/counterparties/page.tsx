'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import { Contract, Counterparty } from '@/lib/types'
import { formatMoney, newId } from '@/lib/utils'
import { Plus, Pencil, Trash2, Phone, Mail, Building2, Search, Briefcase, HardHat } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Portal } from '@/components/ui/Portal'
import { useRouter } from 'next/navigation'

const S = {
  card: { background: '#fff', border: '1px solid var(--line)', borderRadius: 16, boxShadow: 'var(--card-shadow)' } as React.CSSProperties,
  btn: (dark?: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 15px',
    borderRadius: 10, border: `1px solid ${dark ? '#182033' : 'var(--line)'}`,
    background: dark ? '#182033' : '#fff', color: dark ? '#fff' : 'var(--ink)',
    fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  }),
  input: { padding: '10px 13px', border: '1px solid var(--line)', borderRadius: 10, fontFamily: 'inherit', fontSize: 13.5, background: '#fff', color: 'var(--ink)', width: '100%', boxSizing: 'border-box' } as React.CSSProperties,
  label: { fontSize: 12.5, fontWeight: 600, color: 'var(--muted-ink)' } as React.CSSProperties,
}

const AVATAR_PALETTE = ['#2f6bdc', '#1f8a5b', '#e07a1a', '#9b5de5', '#e0325f']
function avatarColor(name: string) { return AVATAR_PALETTE[(name.charCodeAt(0) || 0) % AVATAR_PALETTE.length] }
function initials(name: string) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }

function CounterpartyModal({ open, onClose, initial, defaultType }: { open: boolean; onClose: () => void; initial?: Counterparty; defaultType?: 'customer' | 'contractor' }) {
  const { addCounterparty, updateCounterparty } = useStore()
  const { register, handleSubmit, setValue, watch, reset } = useForm<Counterparty>({
    defaultValues: initial ?? { id: '', name: '', company: '', phone: '', email: '', type: defaultType ?? 'customer' },
  })

  useEffect(() => {
    if (open) reset(initial ?? { id: '', name: '', company: '', phone: '', email: '', type: defaultType ?? 'customer' })
  }, [open, initial])

  const onSubmit = (data: Counterparty) => {
    if (initial) updateCounterparty({ ...data, id: initial.id })
    else addCounterparty({ ...data, id: newId() })
    reset(); onClose()
  }

  if (!open) return null
  const type = watch('type')
  const isClient = type === 'customer'

  return (
    <Portal>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,41,.42)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 480, boxShadow: '0 24px 70px -20px rgba(15,23,41,.5)', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{initial ? 'Редактировать контрагента' : (isClient ? 'Новый заказчик' : 'Новый исполнитель')}</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--bg)', color: 'var(--muted-ink)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={S.label}>ФИО / Название *</label>
              <input {...register('name', { required: true })} placeholder="Иванов Сергей Николаевич" style={S.input} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={S.label}>Компания / Организация</label>
              <input {...register('company')} placeholder="ООО СтройГрупп" style={S.input} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={S.label}>Телефон</label>
                <input {...register('phone')} placeholder="+79161234567" style={S.input} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label style={S.label}>Email</label>
                <input {...register('email')} placeholder="email@example.com" style={S.input} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 22px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
            <button type="button" onClick={onClose} style={S.btn()}>Отмена</button>
            <button type="submit" style={S.btn(true)}>{initial ? 'Сохранить' : 'Создать'}</button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  )
}

function PartyCard({ cp, contracts, onEdit, onDelete }: { cp: Counterparty; contracts: Contract[]; onEdit: () => void; onDelete: () => void }) {
  const router = useRouter()
  const cpContracts = contracts.filter((c) => c.customerId === cp.id || c.contractorId === cp.id)
  const totalAmount = cpContracts.reduce((s, c) => s + c.amount, 0)
  const isCustomer = cp.type === 'customer'
  const contractsFilter = isCustomer ? 'customer' : 'contractor'

  return (
    <div style={{ ...S.card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, transition: 'transform .14s, box-shadow .14s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 8px rgba(20,30,55,.05), 0 18px 40px -22px rgba(20,30,55,.3)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--card-shadow)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: isCustomer ? '#2f6bdc' : '#e07a1a', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {isCustomer ? <Briefcase size={20} /> : <HardHat size={20} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{cp.name}</div>
          {cp.company && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 13, color: 'var(--muted-ink)' }}>
              <Building2 size={13} style={{ color: 'var(--faint)', flexShrink: 0 }} />
              {cp.company}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={onEdit} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none', color: 'var(--faint)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Pencil size={14} /></button>
          <button onClick={onDelete} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'none', color: 'var(--faint)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Trash2 size={14} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--muted-ink)' }}>
        {cp.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Phone size={13} style={{ color: 'var(--faint)', flexShrink: 0 }} /><a href={`tel:${cp.phone}`} style={{ color: 'var(--maf)', textDecoration: 'none' }}>{cp.phone}</a></div>}
        {cp.email && <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Mail size={13} style={{ color: 'var(--faint)', flexShrink: 0 }} /><a href={`mailto:${cp.email}`} style={{ color: 'var(--maf)', textDecoration: 'none' }}>{cp.email}</a></div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--line-soft)', paddingTop: 12, marginTop: 4, fontSize: 13 }}>
        <span style={{ color: 'var(--muted-ink)' }}><b className="tnum" style={{ color: 'var(--ink)' }}>{cpContracts.length}</b> контракта</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {totalAmount > 0 && <span className="tnum" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatMoney(totalAmount)}</span>}
          <button
            onClick={() => router.push(`/contracts?${contractsFilter}=${encodeURIComponent(cp.id)}`)}
            style={{ border: '1px solid #2f6bdc', borderRadius: 8, padding: '6px 9px', background: '#eff6ff', color: '#2f6bdc', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2f6bdc'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; (e.currentTarget as HTMLElement).style.color = '#2f6bdc' }}>
            Открыть контракты
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CounterpartiesPage() {
  const { counterparties, contracts, deleteCounterparty, initSeed } = useStore()
  useEffect(() => { initSeed() }, [])

  const [tab, setTab] = useState<'customers' | 'contractors'>('customers')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Counterparty | undefined>()
  const [defaultType, setDefaultType] = useState<'customer' | 'contractor'>('customer')

  const filter = (list: Counterparty[]) => !search ? list : list.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.company.toLowerCase().includes(search.toLowerCase())
  )
  const customers    = filter(counterparties.filter(c => c.type === 'customer'))
  const contractors  = filter(counterparties.filter(c => c.type === 'contractor'))

  function openForm(type: 'customer' | 'contractor', cp?: Counterparty) {
    setDefaultType(type); setEditing(cp); setFormOpen(true)
  }

  return (
    <div className="fade-in ct-page" style={{ padding: '26px 30px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Контрагенты</h1>
        <button style={S.btn(true)} onClick={() => openForm(tab === 'customers' ? 'customer' : 'contractor')}>
          <Plus size={16} /> {tab === 'customers' ? 'Добавить заказчика' : 'Добавить исполнителя'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: 4, background: '#eceff3', borderRadius: 11 }}>
          {[{ key: 'customers', label: `Заказчики (${counterparties.filter(c => c.type === 'customer').length})` }, { key: 'contractors', label: `Исполнители (${counterparties.filter(c => c.type === 'contractor').length})` }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              style={{ padding: '8px 16px', border: 'none', borderRadius: 8, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', transition: 'background .15s',
                background: tab === t.key ? '#fff' : 'none', color: tab === t.key ? 'var(--ink)' : 'var(--muted-ink)',
                boxShadow: tab === t.key ? '0 1px 3px rgba(20,30,55,.1)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 360, flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
          <input placeholder="Поиск по имени или компании..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...S.input, paddingLeft: 38 }} />
        </div>
      </div>

      <div className="ct-parties-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {tab === 'customers' && (
          customers.length === 0
            ? <div style={{ color: 'var(--faint)', fontSize: 13 }}>Заказчиков не найдено</div>
            : customers.map(cp => (
                <PartyCard key={cp.id} cp={cp} contracts={contracts}
                  onEdit={() => openForm('customer', cp)}
                  onDelete={() => { if (confirm('Удалить контрагента?')) deleteCounterparty(cp.id) }} />
              ))
        )}
        {tab === 'contractors' && (
          contractors.length === 0
            ? <div style={{ color: 'var(--faint)', fontSize: 13 }}>Исполнителей не найдено</div>
            : contractors.map(cp => (
                <PartyCard key={cp.id} cp={cp} contracts={contracts}
                  onEdit={() => openForm('contractor', cp)}
                  onDelete={() => { if (confirm('Удалить контрагента?')) deleteCounterparty(cp.id) }} />
              ))
        )}
      </div>

      <CounterpartyModal open={formOpen} onClose={() => setFormOpen(false)} initial={editing} defaultType={defaultType} />
    </div>
  )
}
