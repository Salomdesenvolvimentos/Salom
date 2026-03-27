/* ================================================================
   SALOM PORTAL — app.js
   Sistema completo de gestão: auth, clientes, chamados (Monday),
   contratos, softwares, perfil, notificações — Supabase backend
================================================================ */

'use strict';

// ================================================================
// SUPABASE CLIENT
// ================================================================
let _supabase;
try {
  if (typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error('Supabase init error:', e);
  _supabase = null;
}

// Client com service role (owner pode criar/remover usuários)
let _supabaseAdmin = null;
try {
  if (typeof SUPABASE_SERVICE_KEY !== 'undefined' &&
      SUPABASE_SERVICE_KEY &&
      !SUPABASE_SERVICE_KEY.includes('sua-service')) {
    _supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
} catch (_) { /* service key não configurada */ }

// ================================================================
// KEEP-ALIVE — ping a cada 5 minutos para manter o Supabase ativo
// ================================================================
(function startKeepAlive() {
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
  setInterval(async () => {
    if (!_supabase) return;
    try {
      // Consulta leve: busca 1 linha da tabela profiles
      await _supabase.from('profiles').select('id').limit(1);
    } catch (_) { /* silencioso — não interromper o app */ }
  }, INTERVAL_MS);
})();

// ================================================================
// ESTADO GLOBAL
// ================================================================
const S = {
  user:       null,
  profile:    null,
  clients:    [],
  softwares:  [],
  profiles:   [],   // todos os perfis (para selects de responsável)
  tickets:    [],
  contracts:  [],
  customCols: [],
  colState:   {},   // { key: { visible, order } }
  realtimeCh: null,
};

// ================================================================
// CONFIGURAÇÕES DE STATUS E TIPO
// ================================================================
const STATUS_CFG = {
  'não iniciado': { color: '#6e7c8d', bg: 'rgba(110,124,141,0.2)',  label: 'Não Iniciado' },
  'em andamento': { color: '#0073ea', bg: 'rgba(0,115,234,0.2)',    label: 'Em Andamento' },
  'pendente':     { color: '#f2a900', bg: 'rgba(242,169,0,0.2)',    label: 'Pendente'     },
  'suspenso':     { color: '#ff7d45', bg: 'rgba(255,125,69,0.2)',   label: 'Suspenso'     },
  'cancelado':    { color: '#e2445c', bg: 'rgba(226,68,92,0.2)',    label: 'Cancelado'    },
  'concluído':    { color: '#00c875', bg: 'rgba(0,200,117,0.2)',    label: 'Concluído'    },
};

const TYPE_CFG = {
  'bug':          { color: '#e2445c', icon: 'fa-bug',     label: 'Bug'           },
  'desenvolvimento':{ color: '#0073ea', icon: 'fa-code',   label: 'Desenvolvimento'},
  'atendimento':  { color: '#00c875', icon: 'fa-headset', label: 'Atendimento'   },
};

// Configuração de permissões de tela
const PERMISSIONS_CFG = {
  dashboard:  { label: 'Dashboard',  icon: 'fa-chart-pie'             },
  clients:    { label: 'Clientes',   icon: 'fa-users'                 },
  tickets:    { label: 'Chamados',   icon: 'fa-tasks'                 },
  contracts:  { label: 'Contratos', icon: 'fa-file-contract'         },
  softwares:  { label: 'Softwares', icon: 'fa-code'                  },
  quotes:     { label: 'Orçamentos', icon: 'fa-file-invoice-dollar'  },
};

// Rótulos de papel
const ROLE_LABELS = {
  owner:    '👑 Owner',
  employee: 'Funcionário',
  client:   'Cliente',
  admin:    'Administrador', // compat legado
};

function hasPermission(key) {
  const role = S.profile?.role;
  if (role === 'owner' || role === 'admin') return true;
  if (role === 'employee') return S.profile?.permissions?.[key] === true;
  return false;
}

const PAGE_TITLES = {
  dashboard:    'Dashboard',
  clients:      'Clientes',
  tickets:      'Chamados',
  contracts:    'Contratos',
  softwares:    'Softwares',
  quotes:       'Orçamentos do Site',
  employees:    'Funcionários',
  settings:     'Configurações',
  profile:      'Meu Perfil',
  'my-tickets': 'Meus Chamados',
};

// Colunas padrão da grade Monday
const DEFAULT_COLS = [
  { key: 'id',             label: '#',            type: 'integer',     editable: false, width: 58  },
  { key: 'task',           label: 'Tarefa',        type: 'string',      editable: true,  width: 280 },
  { key: 'software_id',    label: 'Software',      type: 'ref_software',editable: true,  width: 150 },
  { key: 'client_id',      label: 'Cliente',       type: 'ref_client',  editable: true,  width: 160 },
  { key: 'type',           label: 'Tipo',          type: 'type_select', editable: true,  width: 140 },
  { key: 'status',         label: 'Status',        type: 'status',      editable: true,  width: 150 },
  { key: 'observation',    label: 'Observação',     type: 'string',      editable: true,  width: 220 },
  { key: 'responsible_id', label: 'Responsável',   type: 'responsible', editable: true,  width: 180 },
  { key: 'requester',      label: 'Solicitante',   type: 'requester',   editable: false, width: 180 },
  { key: 'created_at',     label: 'Lançamento',    type: 'date',        editable: false, width: 120 },
  { key: 'deadline',       label: 'Prazo',         type: 'date',        editable: true,  width: 120 },
  { key: 'cost',           label: 'Custo',         type: 'money',       editable: true,  width: 120 },
];

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {
  if (!_supabase) {
    // supabase-config.js não carregou — mensagem já exibida pelo onerror do script
    showLogin();
    return;
  }

  const { data: { session } } = await _supabase.auth.getSession();
  if (session) {
    await onSignedIn(session.user);
  } else {
    showLogin();
  }

  _supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN'  && session) await onSignedIn(session.user);
    if (event === 'SIGNED_OUT')              showLogin();
    if (event === 'TOKEN_REFRESHED' && session && S.user) {
      // Reconectar realtime após refresh do token
      if (S.realtimeCh) {
        _supabase.removeChannel(S.realtimeCh);
        S.realtimeCh = null;
      }
      const isStaff = ['owner', 'employee', 'admin'].includes(S.profile?.role);
      if (isStaff) subscribeRealtime();
    }
  });

  // Reconectar ao retornar de aba em segundo plano
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !S.user) return;
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) { showLogin(); return; }
    // Reconectar realtime se desconectado
    if (!S.realtimeCh) {
      const isStaff = ['owner', 'employee', 'admin'].includes(S.profile?.role);
      if (isStaff) subscribeRealtime();
    }
    // Recarregar página atual para sincronizar dados
    if (typeof navigateTo === 'function' && S.currentPage) {
      navigateTo(S.currentPage);
    }
  });

  // Fechar dropdowns clicando fora
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.notif-wrapper')) {
      document.getElementById('notifDropdown').classList.remove('open');
    }
    const sp = document.getElementById('statusPopup');
    if (sp && !sp.contains(e.target) && !e.target.closest('.status-badge')) {
      sp.style.display = 'none';
    }
  });
});

async function onSignedIn(user) {
  S.user = user;
  S.profile = await fetchProfile(user.id);
  showApp();
  setupUIForRole();
  await Promise.all([loadSoftwares(), loadProfiles(), loadClients()]);

  const isStaff = ['owner', 'employee', 'admin'].includes(S.profile.role);
  if (isStaff) {
    // Navegar para primeira página com permissão
    const firstPage = S.profile.role === 'owner' || S.profile.role === 'admin'
      ? 'dashboard'
      : (Object.keys(PERMISSIONS_CFG).find(k => hasPermission(k)) || 'profile');
    navigateTo(firstPage);
    subscribeRealtime();
  } else {
    navigateTo('my-tickets');
  }
  loadNotifications();
}

// ================================================================
// AUTH
// ================================================================
async function loginUser(e) {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn      = document.getElementById('loginBtn');
  const errEl    = document.getElementById('loginError');

  if (!_supabase) {
    errEl.textContent = '⚠️ Credenciais não configuradas. Verifique supabase-config.js.';
    return;
  }

  errEl.textContent = '';
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';

  const { error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) {
    errEl.textContent = error.message === 'Invalid login credentials'
      ? 'E-mail ou senha incorretos.'
      : error.message;
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
  }
}

async function logout() {
  if (S.realtimeCh) _supabase.removeChannel(S.realtimeCh);
  await _supabase.auth.signOut();
}

async function fetchProfile(uid) {
  let { data, error } = await _supabase.from('profiles').select('*').eq('id', uid).single();
  if (error || !data) {
    // Criar perfil caso o trigger não tenha disparado
    const { data: userData } = await _supabase.auth.getUser();
    const email = userData?.user?.email || uid;
    await _supabase.from('profiles').insert({ id: uid, email, name: email.split('@')[0] });
    ({ data } = await _supabase.from('profiles').select('*').eq('id', uid).single());
  }
  return data || { id: uid, role: 'client' };
}

function togglePassword() {
  const inp  = document.getElementById('loginPassword');
  const icon = document.getElementById('togglePwdIcon');
  if (inp.type === 'password') { inp.type = 'text';     icon.className = 'fas fa-eye-slash'; }
  else                         { inp.type = 'password'; icon.className = 'fas fa-eye';       }
}

// ================================================================
// UI / LAYOUT
// ================================================================
function showLogin() {
  document.getElementById('loginScreen').style.display = '';
  document.getElementById('appScreen').style.display   = 'none';
}

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display   = '';

  const p = S.profile;
  const name   = p.name  || p.email || '-';
  const role   = ROLE_LABELS[p.role] || p.role;
  const avatar = p.avatar_url || 'assets/user-generic.svg';

  setEl('sidebarName',   name);
  setEl('sidebarRole',   role);
  setEl('headerName',    name.split(' ')[0]);
  setImg('sidebarAvatar',   avatar);
  setImg('headerAvatar',    avatar);
}

function setupUIForRole() {
  const role    = S.profile?.role;
  const isStaff = ['owner', 'employee', 'admin'].includes(role);
  const isOwner = role === 'owner';

  document.getElementById('adminNav').style.display  = isStaff ? '' : 'none';
  document.getElementById('clientNav').style.display = isStaff ? 'none' : '';
  document.getElementById('ownerNav').style.display  = isOwner ? '' : 'none';

  // Filtrar nav por permissões do funcionário
  if (isStaff && !isOwner) {
    const permNav = {
      dashboard:  'navItemDashboard',
      clients:    'navItemClients',
      tickets:    'navItemTickets',
      contracts:  'navItemContracts',
      softwares:  'navItemSoftwares',
      quotes:     'navItemQuotes',
    };
    Object.entries(permNav).forEach(([perm, id]) => {
      const el = document.getElementById(id);
      if (el) el.style.display = hasPermission(perm) ? '' : 'none';
    });
  }
}

function navigateTo(page) {
  // Esconder todas as páginas
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  // Mostrar a page destino
  const el = document.getElementById(`page-${page}`);
  if (el) el.style.display = '';

  // Atualizar nav ativo
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`.nav-item[data-page="${page}"]`).forEach(n => n.classList.add('active'));

  // Título
  setEl('pageTitle', PAGE_TITLES[page] || page);

  S.currentPage = page;

  // Fechar sidebar mobile
  document.getElementById('sidebar').classList.remove('mobile-open');

  // Carregar dados da page
  const loaders = {
    dashboard:    loadDashboard,
    clients:      loadClientsPage,
    tickets:      loadTicketsPage,
    contracts:    loadContractsPage,
    softwares:    loadSoftwaresPage,
    quotes:       loadQuotesPage,
    employees:    loadEmployeesPage,
    settings:     loadSettingsPage,
    profile:      loadProfilePage,
    'my-tickets': loadMyTicketsPage,
  };
  if (loaders[page]) loaders[page]();
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ch = document.getElementById('sidebarChevron');
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    sb.classList.toggle('mobile-open');
  } else {
    sb.classList.toggle('collapsed');
    const collapsed = sb.classList.contains('collapsed');
    ch.className = collapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
  }
}

// ================================================================
// UTILITIES
// ================================================================
function setEl(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function setImg(id, src) { const el = document.getElementById(id); if (el) el.src = src; }
function q(sel) { return document.querySelector(sel); }

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d.includes('T') ? d : d + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
}

function formatMoney(v) {
  if (v === null || v === undefined || v === '') return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function generateKey(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr + 'T12:00:00') - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function showToast(message, type = 'success') {
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${icons[type] || icons.success}"></i><span>${escHtml(message)}</span>`;
  document.getElementById('toastContainer').prepend(t);
  setTimeout(() => {
    t.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => t.remove(), 320);
  }, 3500);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function overlayClose(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

let _confirmCb = null;
function confirmDelete(msg, cb) {
  setEl('confirmMessage', msg);
  _confirmCb = cb;
  document.getElementById('confirmActionBtn').onclick = async () => {
    closeModal('confirmModal');
    if (_confirmCb) await _confirmCb();
  };
  openModal('confirmModal');
}

// ================================================================
// DASHBOARD
// ================================================================
async function loadDashboard() {
  const [
    { count: cCount },
    { data: openTix },
    { count: activeContracts },
  ] = await Promise.all([
    _supabase.from('clients').select('*', { count: 'exact', head: true }),
    _supabase.from('tickets').select('id, status, deadline'),
    _supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
  ]);

  const tix = openTix || [];
  const activeStatuses = ['não iniciado', 'em andamento', 'pendente', 'suspenso'];
  const openCount   = tix.filter(t => activeStatuses.includes(t.status)).length;
  const today       = new Date().toISOString().slice(0, 10);
  const overdueCount= tix.filter(t => t.deadline && t.deadline < today && t.status !== 'concluído' && t.status !== 'cancelado').length;

  setEl('statClients',   cCount  || 0);
  setEl('statOpen',      openCount);
  setEl('statContracts', activeContracts || 0);
  setEl('statOverdue',   overdueCount);

  // Chamados recentes
  const { data: recent } = await _supabase.from('tickets')
    .select('id, task, status, created_at, clients(name)')
    .order('created_at', { ascending: false })
    .limit(8);

  const el = document.getElementById('recentTicketsList');
  if (!el) return;
  if (!recent?.length) { el.innerHTML = '<p style="color:#6b7280;font-size:13px">Nenhum chamado ainda.</p>'; return; }
  el.innerHTML = recent.map(t => {
    const sc = STATUS_CFG[t.status] || STATUS_CFG['não iniciado'];
    return `<div class="recent-ticket-item" onclick="navigateTo('tickets')">
      <span class="status-badge" style="background:${sc.bg};color:${sc.color}">${sc.label}</span>
      <div class="recent-ticket-info">
        <strong>#${t.id} ${escHtml(t.task)}</strong>
        <span>${t.clients?.name ? escHtml(t.clients.name) : 'Sem cliente'} · ${formatDate(t.created_at)}</span>
      </div>
    </div>`;
  }).join('');

  // Chart de status
  const chartEl = document.getElementById('statusChart');
  if (!chartEl) return;
  const total = tix.length || 1;
  const statusKeys = Object.keys(STATUS_CFG);
  chartEl.innerHTML = statusKeys.map(s => {
    const cnt = tix.filter(t => t.status === s).length;
    const pct = Math.round((cnt / total) * 100);
    const cfg = STATUS_CFG[s];
    return `<div class="status-bar-item">
      <div class="status-bar-label"><span>${cfg.label}</span><span>${cnt}</span></div>
      <div class="status-bar-track"><div class="status-bar-fill" style="width:${pct}%;background:${cfg.color}"></div></div>
    </div>`;
  }).join('');
}

// ================================================================
// CLIENTES
// ================================================================
async function loadProfiles() {
  const { data } = await _supabase.from('profiles').select('id, name, email, avatar_url, role');
  S.profiles = data || [];
}

async function loadClients() {
  const { data } = await _supabase.from('clients').select('*').order('name');
  S.clients = data || [];
}

async function loadClientsPage() {
  await loadClients();
  renderClientsTable(S.clients);
}

function renderClientsTable(list) {
  const body = document.getElementById('clientsBody');
  if (!body) return;
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="6" class="table-loading">Nenhum cliente cadastrado.</td></tr>';
    return;
  }
  body.innerHTML = list.map(c => `
    <tr>
      <td><strong>${escHtml(c.name)}</strong></td>
      <td><span class="badge badge-${c.type}">${c.type === 'empresa' ? 'Empresa' : 'Pessoal'}</span></td>
      <td>${escHtml(c.phone || '—')}</td>
      <td>${escHtml(c.email || '—')}</td>
      <td>${c.user_id ? '<span class="badge badge-empresa">Vinculado</span>' : '<span style="color:#6b7280;font-size:12px">Não vinculado</span>'}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn edit"   onclick="openClientModal(${JSON.stringify(c).replace(/"/g,"'")})" title="Editar"><i class="fas fa-pen"></i></button>
          <button class="action-btn delete" onclick="askDeleteClient('${c.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterClients() {
  const q = document.getElementById('clientSearch')?.value.toLowerCase() || '';
  const filtered = S.clients.filter(c =>
    c.name?.toLowerCase().includes(q) ||
    c.email?.toLowerCase().includes(q) ||
    c.phone?.toLowerCase().includes(q)
  );
  renderClientsTable(filtered);
}

function openClientModal(client) {
  const isEdit = typeof client === 'object' && client?.id;
  setEl('clientModalTitle', isEdit ? 'Editar Cliente' : 'Novo Cliente');
  document.getElementById('clientId').value      = isEdit ? client.id    : '';
  document.getElementById('clientName').value    = isEdit ? client.name || ''    : '';
  document.getElementById('clientType').value    = isEdit ? client.type || 'pessoal' : 'pessoal';
  document.getElementById('clientPhone').value   = isEdit ? client.phone  || '' : '';
  document.getElementById('clientEmail').value   = isEdit ? client.email  || '' : '';
  document.getElementById('clientAddress').value = isEdit ? client.address || '' : '';
  document.getElementById('clientNotes').value   = isEdit ? client.notes  || '' : '';
  openModal('clientModal');
}

async function saveClient(e) {
  e.preventDefault();
  const id = document.getElementById('clientId').value;
  const payload = {
    name:    document.getElementById('clientName').value.trim(),
    type:    document.getElementById('clientType').value,
    phone:   document.getElementById('clientPhone').value.trim(),
    email:   document.getElementById('clientEmail').value.trim() || null,
    address: document.getElementById('clientAddress').value.trim(),
    notes:   document.getElementById('clientNotes').value.trim(),
  };

  let error;
  if (id) {
    ({ error } = await _supabase.from('clients').update(payload).eq('id', id));
  } else {
    ({ error } = await _supabase.from('clients').insert(payload));
  }

  if (error) { showToast(error.message, 'error'); return; }
  showToast(id ? 'Cliente atualizado!' : 'Cliente cadastrado!');
  closeModal('clientModal');
  await loadClientsPage();
}

function askDeleteClient(id) {
  confirmDelete('Excluir este cliente? Chamados e contratos vinculados perderão a referência.', async () => {
    const { error } = await _supabase.from('clients').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Cliente excluído.');
    await loadClientsPage();
  });
}

// ================================================================
// SOFTWARES
// ================================================================
async function loadSoftwares() {
  const { data } = await _supabase.from('softwares').select('*').order('name');
  S.softwares = data || [];
}

async function loadSoftwaresPage() {
  await loadSoftwares();
  renderSoftwaresTable(S.softwares);
}

// ================================================================
// ORÇAMENTOS DO SITE
// ================================================================
let _allQuotes = [];

const QUOTE_TIPO_LABELS = {
  site:      'Site / Landing Page',
  ecommerce: 'E-commerce',
  app:       'Aplicativo Mobile',
  sistema:   'Sistema Web',
  outro:     'Outro',
};

const QUOTE_STATUS_COLORS = {
  'novo':             '#00d9ff',
  'em análise':       '#f6ad55',
  'proposta enviada': '#9f7aea',
  'fechado':          '#00ff88',
  'cancelado':        '#fc8181',
};

async function loadQuotesPage() {
  const body = document.getElementById('quotesBody');
  if (body) body.innerHTML = '<tr><td colspan="8" class="table-loading"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';

  const { data, error } = await _supabase
    .from('quotes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { showToast('Erro ao carregar orçamentos: ' + error.message, 'error'); return; }
  _allQuotes = data || [];
  renderQuotesTable(_allQuotes);

  // Badge com quantidade de novos
  const novos = _allQuotes.filter(q => q.status === 'novo').length;
  const badge = document.getElementById('quotesBadge');
  if (badge) { badge.textContent = novos; badge.style.display = novos ? '' : 'none'; }
}

function renderQuotesTable(list) {
  const body = document.getElementById('quotesBody');
  if (!body) return;
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="8" class="table-loading">Nenhum orçamento recebido ainda.</td></tr>';
    return;
  }
  body.innerHTML = list.map(q => {
    const cor  = QUOTE_STATUS_COLORS[q.status] || '#a0aec0';
    const tipo = QUOTE_TIPO_LABELS[q.tipo]     || q.tipo;
    const data = new Date(q.created_at).toLocaleDateString('pt-BR');
    return `
    <tr>
      <td><strong>${escHtml(q.nome)}</strong></td>
      <td>${escHtml(q.empresa || '—')}</td>
      <td><a href="https://wa.me/55${q.whatsapp.replace(/\D/g,'')}" target="_blank" style="color:#00d9ff">${escHtml(q.whatsapp)}</a></td>
      <td>${escHtml(q.email)}</td>
      <td>${escHtml(tipo)}</td>
      <td>
        <select class="status-select" style="background:${cor}22;color:${cor};border:1px solid ${cor}55;border-radius:6px;padding:4px 8px;font-size:0.82rem;cursor:pointer"
          onchange="updateQuoteStatus('${q.id}', this.value)">
          ${['novo','em análise','proposta enviada','fechado','cancelado'].map(s =>
            `<option value="${s}" ${q.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
          ).join('')}
        </select>
      </td>
      <td>${escHtml(data)}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn edit" onclick="openQuoteDetail(${JSON.stringify(q).replace(/"/g,"'")})" title="Ver detalhes"><i class="fas fa-eye"></i></button>
          <button class="action-btn delete" onclick="askDeleteQuote('${q.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterQuotes() {
  const q   = document.getElementById('quotesSearch')?.value.toLowerCase() || '';
  const st  = document.getElementById('quotesStatusFilter')?.value || '';
  renderQuotesTable(_allQuotes.filter(r =>
    (!st || r.status === st) &&
    (!q  || r.nome?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q)
          || r.empresa?.toLowerCase().includes(q) || r.tipo?.toLowerCase().includes(q))
  ));
}

async function updateQuoteStatus(id, status) {
  const { error } = await _supabase.from('quotes').update({ status }).eq('id', id);
  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  const q = _allQuotes.find(r => r.id === id);
  if (q) q.status = status;
  showToast('Status atualizado!');
}

function openQuoteDetail(q) {
  const tipo = QUOTE_TIPO_LABELS[q.tipo] || q.tipo;
  const data = new Date(q.created_at).toLocaleString('pt-BR');
  const html = `
    <div style="display:grid;gap:12px">
      <div><strong>Nome:</strong> ${escHtml(q.nome)}</div>
      <div><strong>Empresa:</strong> ${escHtml(q.empresa || '—')}</div>
      <div><strong>WhatsApp:</strong> <a href="https://wa.me/55${(q.whatsapp||'').replace(/\D/g,'')}" target="_blank" style="color:#00d9ff">${escHtml(q.whatsapp)}</a></div>
      <div><strong>E-mail:</strong> ${escHtml(q.email)}</div>
      <div><strong>Tipo de projeto:</strong> ${escHtml(tipo)}</div>
      <div><strong>Recebido em:</strong> ${escHtml(data)}</div>
      <div><strong>Descrição:</strong><br><p style="background:var(--bg-hover);padding:12px;border-radius:8px;margin-top:6px;white-space:pre-wrap">${escHtml(q.descricao)}</p></div>
    </div>`;
  document.getElementById('quoteDetailBody').innerHTML = html;
  openModal('quoteDetailModal');
}

async function askDeleteQuote(id) {
  confirmDelete('Excluir este orçamento permanentemente?', async () => {
    const { error } = await _supabase.from('quotes').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Orçamento excluído.');
    await loadQuotesPage();
  });
}

function renderSoftwaresTable(list) {
  const body = document.getElementById('softwaresBody');
  if (!body) return;
  if (!list.length) { body.innerHTML = '<tr><td colspan="4" class="table-loading">Nenhum software cadastrado.</td></tr>'; return; }
  body.innerHTML = list.map(s => `
    <tr>
      <td><strong>${escHtml(s.name)}</strong></td>
      <td>${escHtml(s.version || '—')}</td>
      <td>${escHtml(s.description || '—')}</td>
      <td>
        <div class="table-actions">
          <button class="action-btn edit"   onclick="openSoftwareModal(${JSON.stringify(s).replace(/"/g,"'")})" title="Editar"><i class="fas fa-pen"></i></button>
          <button class="action-btn delete" onclick="askDeleteSoftware('${s.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterSoftwares() {
  const q = document.getElementById('softwareSearch')?.value.toLowerCase() || '';
  renderSoftwaresTable(S.softwares.filter(s =>
    s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
  ));
}

function openSoftwareModal(sw) {
  const isEdit = typeof sw === 'object' && sw?.id;
  setEl('softwareModalTitle', isEdit ? 'Editar Software' : 'Novo Software');
  document.getElementById('softwareId').value          = isEdit ? sw.id          : '';
  document.getElementById('softwareName').value        = isEdit ? sw.name       || '' : '';
  document.getElementById('softwareVersion').value     = isEdit ? sw.version    || '' : '';
  document.getElementById('softwareDescription').value = isEdit ? sw.description || '' : '';
  openModal('softwareModal');
}

async function saveSoftware(e) {
  e.preventDefault();
  const id = document.getElementById('softwareId').value;
  const payload = {
    name:        document.getElementById('softwareName').value.trim(),
    version:     document.getElementById('softwareVersion').value.trim(),
    description: document.getElementById('softwareDescription').value.trim(),
  };

  let error;
  if (id) { ({ error } = await _supabase.from('softwares').update(payload).eq('id', id)); }
  else     { ({ error } = await _supabase.from('softwares').insert(payload)); }

  if (error) { showToast(error.message, 'error'); return; }
  showToast(id ? 'Software atualizado!' : 'Software cadastrado!');
  closeModal('softwareModal');
  await loadSoftwares();
  if (S.currentPage === 'softwares') renderSoftwaresTable(S.softwares);
}

async function askDeleteSoftware(id) {
  confirmDelete('Excluir este software? Chamados vinculados perderão a referência.', async () => {
    const { error } = await _supabase.from('softwares').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Software excluído.');
    await loadSoftwaresPage();
  });
}

// ================================================================
// TICKETS — MONDAY GRID
// ================================================================
let _dragColKey      = null;
let _allTickets      = [];
let _filteredTickets = [];

async function loadTicketsPage() {
  // Carregar colunas customizadas + state salvo
  await loadCustomCols();
  loadColState();
  await fetchTickets();
  populateSoftwareFilter('filterSoftware');
  renderMondayGrid();
}

async function fetchTickets() {
  const { data, error } = await _supabase.from('tickets')
    .select('*, softwares(id,name), clients(id,name), profiles!tickets_responsible_id_fkey(id,name,avatar_url)')
    .order('id', { ascending: false });

  if (error) { showToast('Erro ao carregar chamados.', 'error'); return; }
  _allTickets = data || [];
  _filteredTickets = [..._allTickets];
}

async function loadCustomCols() {
  const { data } = await _supabase.from('ticket_columns').select('*').order('position');
  S.customCols = data || [];
}

// Monta lista final de colunas (padrão + customizadas) respeitando estado salvo
function getActiveCols() {
  const stdCols  = DEFAULT_COLS.map(c => ({ ...c }));
  const custCols = S.customCols.map(cc => ({
    key:      cc.col_key,
    label:    cc.name,
    type:     `custom_${cc.data_type}`,
    editable: true,
    width:    150,
    customId: cc.id,
  }));

  const all = [...stdCols, ...custCols];

  // Aplicar estado salvo
  all.forEach(c => {
    const st = S.colState[c.key];
    if (st !== undefined) c.visible = st.visible !== false;
    else c.visible = true;
  });

  // Ordenar pela ordem salva
  all.sort((a, b) => {
    const oa = S.colState[a.key]?.order ?? DEFAULT_COLS.findIndex(d => d.key === a.key);
    const ob = S.colState[b.key]?.order ?? DEFAULT_COLS.findIndex(d => d.key === b.key);
    return oa - ob;
  });

  return all;
}

function loadColState() {
  try {
    const saved = localStorage.getItem(`scols_${S.user?.id}`);
    S.colState = saved ? JSON.parse(saved) : {};
  } catch { S.colState = {}; }
}

function saveColState(cols) {
  cols.forEach((c, i) => {
    S.colState[c.key] = { visible: c.visible, order: i };
  });
  localStorage.setItem(`scols_${S.user?.id}`, JSON.stringify(S.colState));
}

function renderMondayGrid() {
  const cols = getActiveCols();
  renderColManagerPanel(cols);
  renderGridHead(cols);
  renderGridBody(cols, _filteredTickets);
}

function renderGridHead(cols) {
  const head = document.getElementById('mondayHead');
  if (!head) return;
  const visibleCols = cols.filter(c => c.visible);

  head.innerHTML = `<tr>
    ${visibleCols.map((c, idx) => `
      <th class="monday-th"
          draggable="true"
          data-col="${c.key}"
          ondragstart="onColDragStart(event,'${c.key}')"
          ondragover="onColDragOver(event)"
          ondrop="onColDrop(event,'${c.key}')"
          ondragleave="onColDragLeave(event)"
          style="width:${c.width}px;min-width:${c.width}px">
        <div class="th-inner">
          <span>${escHtml(c.label)}</span>
          ${idx > 0 ? `<i class="fas fa-eye-slash th-hide" onclick="hideCol('${c.key}',event)" title="Ocultar coluna"></i>` : ''}
        </div>
      </th>`).join('')}
    <th class="monday-th" style="width:90px;min-width:90px">
      <div class="th-inner">Ações</div>
    </th>
  </tr>`;
}

function renderGridBody(cols, tickets) {
  const body = document.getElementById('mondayBody');
  if (!body) return;
  const visibleCols = cols.filter(c => c.visible);

  if (!tickets.length) {
    body.innerHTML = `<tr><td colspan="${visibleCols.length + 1}" class="table-loading">Nenhum chamado encontrado.</td></tr>`;
    return;
  }

  body.innerHTML = tickets.map(t => `
    <tr data-tid="${t.id}">
      ${visibleCols.map(c => `
        <td class="monday-td" data-col="${c.key}" data-tid="${t.id}"
            ${c.editable ? `onclick="cellClick(this,'${c.key}',${t.id})"` : ''}>
          <div class="cell-content">${renderCellValue(t, c)}</div>
        </td>`).join('')}
      <td class="monday-td">
        <div class="cell-content" style="justify-content:center;gap:6px">
          <button class="action-btn edit"   onclick="openTicketModal(${t.id})" title="Editar"><i class="fas fa-pen"></i></button>
          <button class="action-btn delete" onclick="askDeleteTicket(${t.id})" title="Excluir"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderCellValue(ticket, col) {
  const key = col.key;

  if (key === 'id')          return `<span style="color:#6b7280;font-weight:700">#${ticket.id}</span>`;
  if (key === 'status') {
    const s = STATUS_CFG[ticket.status] || STATUS_CFG['não iniciado'];
    return `<span class="status-badge" style="background:${s.bg};color:${s.color}">${s.label}</span>`;
  }
  if (key === 'type') {
    const tc = TYPE_CFG[ticket.type] || TYPE_CFG['desenvolvimento'];
    return `<span class="badge" style="background:${tc.color}22;color:${tc.color}"><i class="fas ${tc.icon}"></i> ${tc.label}</span>`;
  }
  if (key === 'software_id') {
    const sw = ticket.softwares;
    return sw ? escHtml(sw.name) : '<span style="color:#6b7280">—</span>';
  }
  if (key === 'client_id') {
    const cl = ticket.clients;
    return cl ? escHtml(cl.name) : '<span style="color:#6b7280">—</span>';
  }
  if (key === 'responsible_id') {
    const rp = ticket.profiles;
    if (!rp) return '<span style="color:#6b7280">—</span>';
    const av = rp.avatar_url || 'assets/user-generic.svg';
    return `<div class="responsible-cell"><img src="${escHtml(av)}" class="responsible-avatar" onerror="this.src='assets/user-generic.svg'"><span>${escHtml(rp.name || rp.email || '—')}</span></div>`;
  }
  if (key === 'requester') {
    const req = S.profiles.find(p => p.id === ticket.created_by);
    if (!req) return '<span style="color:#6b7280">—</span>';
    const av = req.avatar_url || 'assets/user-generic.svg';
    return `<div class="responsible-cell"><img src="${escHtml(av)}" class="responsible-avatar" onerror="this.src='assets/user-generic.svg'"><span>${escHtml(req.name || req.email || '—')}</span></div>`;
  }
  if (key === 'created_at') return formatDate(ticket.created_at);
  if (key === 'deadline') {
    if (!ticket.deadline) return '<span style="color:#6b7280">—</span>';
    const done = ticket.status === 'concluído' || ticket.status === 'cancelado';
    const days = daysUntil(ticket.deadline);
    const color = !done && days < 0 ? '#e2445c' : !done && days <= 3 ? '#f2a900' : '#b0b8d4';
    return `<span style="color:${color}">${formatDate(ticket.deadline)}${!done && days < 0 ? ' ⚠' : ''}</span>`;
  }
  if (key === 'cost')    return ticket.cost != null ? formatMoney(ticket.cost) : '<span style="color:#6b7280">—</span>';
  if (key === 'task')    return `<span style="font-weight:500">${escHtml(ticket.task || '—')}</span>`;
  if (key === 'observation') {
    const v = ticket.observation;
    if (!v) return '<span style="color:#6b7280">—</span>';
    return `<span style="color:#b0b8d4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;display:block">${escHtml(v)}</span>`;
  }

  // Custom coluna
  if (key.startsWith('custom_') || col.type?.startsWith('custom_')) {
    const v = ticket.custom_data?.[key];
    if (v === null || v === undefined || v === '') return '<span style="color:#6b7280">—</span>';
    if (col.type === 'custom_money')   return formatMoney(v);
    if (col.type === 'custom_date')    return formatDate(v);
    return escHtml(String(v));
  }

  return escHtml(String(ticket[key] ?? '—'));
}

// ---- Inline cell editing ----
function cellClick(td, colKey, ticketId) {
  // Não editar se já tem input
  if (td.querySelector('input, select')) return;

  const ticket = _allTickets.find(t => t.id === ticketId);
  if (!ticket) return;

  const col = getActiveCols().find(c => c.key === colKey);
  if (!col || !col.editable) return;

  if (col.type === 'status') {
    showStatusPopup(td, ticket);
    return;
  }

  const cell = td.querySelector('.cell-content');
  const originalHTML = cell.innerHTML;

  let input;

  if (col.type === 'ref_software') {
    input = buildSelect(S.softwares.map(s => ({ val: s.id, label: s.name })), ticket.software_id);
  } else if (col.type === 'ref_client') {
    input = buildSelect(S.clients.map(c => ({ val: c.id, label: c.name })), ticket.client_id);
  } else if (col.type === 'responsible') {
    const staff = S.profiles.filter(p => ['owner', 'employee', 'admin'].includes(p.role));
    input = buildSelect(staff.map(p => ({ val: p.id, label: p.name || p.email })), ticket.responsible_id);
  } else if (col.type === 'type_select') {
    input = buildSelect([
      { val: 'bug', label: 'Bug' },
      { val: 'desenvolvimento', label: 'Desenvolvimento' },
      { val: 'atendimento', label: 'Atendimento' },
    ], ticket.type);
  } else if (col.type === 'date' || col.type === 'custom_date') {
    input = document.createElement('input');
    input.type = 'date';
    input.className = 'cell-input';
    const raw = col.type === 'custom_date' ? ticket.custom_data?.[colKey] : ticket[colKey];
    input.value = raw || '';
  } else if (col.type === 'money' || col.type === 'custom_money' || col.type === 'custom_integer') {
    input = document.createElement('input');
    input.type = 'number';
    input.step = col.type === 'custom_integer' ? '1' : '0.01';
    input.style.width = '100%';
    input.className = 'cell-input';
    const raw = col.type.startsWith('custom_') ? ticket.custom_data?.[colKey] : ticket[colKey];
    input.value = raw ?? '';
  } else {
    // string / custom_string
    input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-input';
    const raw = col.type.startsWith('custom_') ? ticket.custom_data?.[colKey] : ticket[colKey];
    input.value = raw || '';
  }

  cell.innerHTML = '';
  cell.appendChild(input);
  input.focus();

  let committed = false;

  const commit = async () => {
    if (committed) return;
    committed = true;
    const newVal = input.value;
    await saveCellValue(ticket, col, newVal);
  };

  const cancel = () => {
    if (committed) return;
    committed = true;
    cell.innerHTML = originalHTML;
  };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter')  { input.blur(); }
    if (ev.key === 'Escape') { committed = true; input.removeEventListener('blur', commit); cell.innerHTML = originalHTML; }
  });
}

function buildSelect(options, currentVal) {
  const sel = document.createElement('select');
  sel.className = 'cell-select';
  sel.innerHTML = '<option value="">— Nenhum —</option>' +
    options.map(o => `<option value="${o.val}" ${o.val === currentVal ? 'selected' : ''}>${escHtml(o.label)}</option>`).join('');
  return sel;
}

async function saveCellValue(ticket, col, newVal) {
  const isCustom   = col.type?.startsWith('custom_');
  const isRef      = ['ref_software', 'ref_client', 'responsible'].includes(col.type);
  let dbField, dbValue;

  if (isCustom) {
    const merged = { ...ticket.custom_data, [col.key]: newVal };
    const { error } = await _supabase.from('tickets').update({ custom_data: merged }).eq('id', ticket.id);
    if (error) { showToast('Erro ao salvar.', 'error'); } else {
      ticket.custom_data = merged;
      showToast('Salvo!', 'info');
      updateRowCell(ticket);
    }
    return;
  }

  if (col.type === 'type_select') dbField = 'type';
  else if (col.type === 'responsible') dbField = 'responsible_id';
  else if (col.type === 'ref_software') dbField = 'software_id';
  else if (col.type === 'ref_client')   dbField = 'client_id';
  else dbField = col.key;

  dbValue = newVal === '' ? null : newVal;

  const { error } = await _supabase.from('tickets').update({ [dbField]: dbValue }).eq('id', ticket.id);
  if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }

  // Atualizar estado local
  if (dbField === 'software_id') {
    ticket.softwares = S.softwares.find(s => s.id === dbValue) || null;
    ticket.software_id = dbValue;
  } else if (dbField === 'client_id') {
    ticket.clients = S.clients.find(c => c.id === dbValue) || null;
    ticket.client_id = dbValue;
  } else if (dbField === 'responsible_id') {
    ticket.profiles = S.profiles.find(p => p.id === dbValue) || null;
    ticket.responsible_id = dbValue;

    // Notificar responsável
    if (dbValue && dbValue !== S.user.id) {
      await createNotification(dbValue, 'Chamado atribuído a você',
        `O chamado #${ticket.id} "${ticket.task}" foi atribuído a você.`, ticket.id);
    }
  } else {
    ticket[dbField] = dbValue;
    // Notificar cliente se status mudou
    if (dbField === 'status' && ticket.client_id) {
      const client = S.clients.find(c => c.id === ticket.client_id);
      if (client?.user_id) {
        await createNotification(client.user_id,
          'Status do seu chamado atualizado',
          `Chamado #${ticket.id}: status alterado para "${dbValue}".`, ticket.id);
      }
    }
  }

  showToast('Salvo!', 'info');
  updateRowCell(ticket);
}

// Re-renderiza as células da linha
function updateRowCell(ticket) {
  const cols = getActiveCols().filter(c => c.visible);
  const row  = document.querySelector(`tr[data-tid="${ticket.id}"]`);
  if (!row) return;
  cols.forEach(c => {
    const td   = row.querySelector(`td[data-col="${c.key}"]`);
    if (!td) return;
    td.querySelector('.cell-content').innerHTML = renderCellValue(ticket, c);
  });
}

// Status popup
function showStatusPopup(td, ticket) {
  const popup = document.getElementById('statusPopup');
  const rect  = td.getBoundingClientRect();
  popup.style.top     = `${rect.bottom + window.scrollY + 4}px`;
  popup.style.left    = `${rect.left + window.scrollX}px`;
  popup.style.display = 'block';

  popup.innerHTML = Object.entries(STATUS_CFG).map(([key, cfg]) => `
    <div class="status-popup-item" onclick="applyStatus(${ticket.id},'${key}')">
      <span class="status-dot" style="background:${cfg.color}"></span>
      <span style="color:${key === ticket.status ? cfg.color : '#e0e6f0'}">${cfg.label}</span>
      ${key === ticket.status ? '<i class="fas fa-check" style="margin-left:auto;color:#00c875;font-size:11px"></i>' : ''}
    </div>
  `).join('');
}

async function applyStatus(ticketId, newStatus) {
  document.getElementById('statusPopup').style.display = 'none';
  const ticket = _allTickets.find(t => t.id === ticketId);
  if (!ticket) return;
  await saveCellValue(ticket, { key: 'status', type: 'status' }, newStatus);
}

// ---- Drag & Drop de colunas ----
function onColDragStart(e, key) {
  _dragColKey = key;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onColDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function onColDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onColDrop(e, targetKey) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!_dragColKey || _dragColKey === targetKey) return;

  const cols = getActiveCols();
  const srcIdx = cols.findIndex(c => c.key === _dragColKey);
  const dstIdx = cols.findIndex(c => c.key === targetKey);
  if (srcIdx < 0 || dstIdx < 0) return;

  const [moved] = cols.splice(srcIdx, 1);
  cols.splice(dstIdx, 0, moved);

  saveColState(cols);
  renderMondayGrid();
  _dragColKey = null;
}

// ---- Gerenciador de colunas ----
function toggleColManager() {
  const panel = document.getElementById('colManagerPanel');
  const open  = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = open ? '' : 'none';
  if (open) renderColManagerPanel(getActiveCols());
}

function renderColManagerPanel(cols) {
  const body = document.getElementById('colManagerBody');
  if (!body) return;
  body.innerHTML = cols.map(c => `
    <div class="col-toggle ${c.visible ? 'active' : ''}" onclick="toggleColVisibility('${c.key}')">
      <i class="fas ${c.visible ? 'fa-eye' : 'fa-eye-slash'}"></i>
      <span>${escHtml(c.label)}</span>
      ${c.customId ? `<i class="fas fa-trash" style="margin-left:auto;color:#6b7280;font-size:11px" onclick="deleteCustomCol(event,'${c.customId}')"></i>` : ''}
    </div>
  `).join('');
}

function toggleColVisibility(key) {
  const cols = getActiveCols();
  const col  = cols.find(c => c.key === key);
  if (col) {
    col.visible = !col.visible;
    saveColState(cols);
    renderMondayGrid();
  }
}

function hideCol(key, e) {
  e.stopPropagation();
  toggleColVisibility(key);
}

// ---- Custom columns ----
function openCustomColModal() {
  document.getElementById('customColName').value = '';
  document.getElementById('customColType').value = 'string';
  openModal('customColModal');
}

async function saveCustomCol(e) {
  e.preventDefault();
  const name  = document.getElementById('customColName').value.trim();
  const dtype = document.getElementById('customColType').value;
  const key   = generateKey(name);

  const { error } = await _supabase.from('ticket_columns').insert({
    name,
    col_key:   key,
    data_type: dtype,
    position:  (S.customCols.length + 1) * 10,
  });

  if (error) { showToast(error.message === 'duplicate key value violates unique constraint "ticket_columns_col_key_key"' ? 'Já existe coluna com esse nome.' : error.message, 'error'); return; }
  showToast('Coluna adicionada!');
  closeModal('customColModal');
  await loadCustomCols();
  renderMondayGrid();
}

async function deleteCustomCol(e, colId) {
  e.stopPropagation();
  confirmDelete('Excluir esta coluna personalizada? Os dados salvos nos chamados serão mantidos mas não exibidos.', async () => {
    const col = S.customCols.find(c => c.id === colId);
    const { error } = await _supabase.from('ticket_columns').delete().eq('id', colId);
    if (error) { showToast(error.message, 'error'); return; }
    if (col) delete S.colState[col.col_key];
    await loadCustomCols();
    renderMondayGrid();
    showToast('Coluna excluída.');
  });
}

// ---- Filtros ----
function filterTickets() {
  const q        = document.getElementById('ticketSearch')?.value.toLowerCase() || '';
  const status   = document.getElementById('filterStatus')?.value   || '';
  const type     = document.getElementById('filterType')?.value     || '';
  const software = document.getElementById('filterSoftware')?.value || '';

  _filteredTickets = _allTickets.filter(t => {
    const matchQ  = !q || t.task?.toLowerCase().includes(q) ||
      t.clients?.name?.toLowerCase().includes(q) ||
      t.softwares?.name?.toLowerCase().includes(q) ||
      String(t.id).includes(q);
    const matchS  = !status   || t.status        === status;
    const matchT  = !type     || t.type          === type;
    const matchSW = !software || String(t.software_id) === software;
    return matchQ && matchS && matchT && matchSW;
  });

  renderGridBody(getActiveCols().filter(c => c.visible ? c : null), _filteredTickets);
}

function populateSoftwareFilter(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  // remove opções antigas exceto a primeira ("Todos softwares")
  while (sel.options.length > 1) sel.remove(1);
  S.softwares.forEach(sw => {
    const opt = document.createElement('option');
    opt.value = sw.id;
    opt.textContent = sw.name;
    sel.appendChild(opt);
  });
}

// ---- Modal Ticket ----
async function openTicketModal(idOrObj) {
  const isEdit = typeof idOrObj === 'number';
  const ticket = isEdit ? _allTickets.find(t => t.id === idOrObj) : null;

  setEl('ticketModalTitle', isEdit ? `Editar Chamado #${ticket?.id}` : 'Novo Chamado');

  // Popular selects
  const swSel  = document.getElementById('ticketSoftware');
  const clSel  = document.getElementById('ticketClient');
  const rpSel  = document.getElementById('ticketResponsible');

  swSel.innerHTML = '<option value="">— Selecione —</option>' +
    S.softwares.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  clSel.innerHTML = '<option value="">— Selecione —</option>' +
    S.clients.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
  rpSel.innerHTML = '<option value="">— Selecione —</option>' +
    S.profiles.filter(p => ['owner', 'employee', 'admin'].includes(p.role)).map(p =>
      `<option value="${p.id}">${escHtml(p.name || p.email)}</option>`).join('');

  if (ticket) {
    document.getElementById('ticketId').value          = ticket.id;
    document.getElementById('ticketTask').value         = ticket.task || '';
    document.getElementById('ticketType').value         = ticket.type || 'desenvolvimento';
    document.getElementById('ticketStatus').value       = ticket.status || 'não iniciado';
    document.getElementById('ticketObservation').value  = ticket.observation || '';
    document.getElementById('ticketDeadline').value     = ticket.deadline || '';
    document.getElementById('ticketCost').value         = ticket.cost ?? '';
    swSel.value = ticket.software_id || '';
    clSel.value = ticket.client_id   || '';
    rpSel.value = ticket.responsible_id || '';
  } else {
    document.getElementById('ticketId').value = '';
    document.getElementById('ticketTask').value = '';
    document.getElementById('ticketType').value = 'desenvolvimento';
    document.getElementById('ticketStatus').value = 'não iniciado';
    document.getElementById('ticketObservation').value = '';
    document.getElementById('ticketDeadline').value = '';
    document.getElementById('ticketCost').value = '';
    swSel.value = ''; clSel.value = ''; rpSel.value = '';
  }

  onTicketTypeChange();

  // Carregar chamados de clientes para víncular (tipo atendimento)
  await loadClientChamados();

  openModal('ticketModal');
}

function onTicketTypeChange() {
  const t = document.getElementById('ticketType')?.value;
  const g = document.getElementById('linkedChamadoGroup');
  if (g) g.style.display = t === 'atendimento' ? '' : 'none';
}

async function loadClientChamados() {
  const sel = document.getElementById('ticketLinkedChamado');
  if (!sel) return;
  const { data } = await _supabase.from('tickets')
    .select('id, task, clients(name)')
    .eq('source', 'client')
    .not('status', 'in', '("cancelado","concluído")')
    .order('id', { ascending: false })
    .limit(50);

  sel.innerHTML = '<option value="">Nenhum</option>' +
    (data || []).map(t =>
      `<option value="${t.id}">#${t.id} — ${escHtml(t.task)}${t.clients?.name ? ' (' + escHtml(t.clients.name) + ')' : ''}</option>`
    ).join('');
}

async function saveTicket(e) {
  e.preventDefault();
  const id = document.getElementById('ticketId').value;

  const payload = {
    task:           document.getElementById('ticketTask').value.trim(),
    type:           document.getElementById('ticketType').value,
    status:         document.getElementById('ticketStatus').value,
    observation:    document.getElementById('ticketObservation').value.trim(),
    deadline:       document.getElementById('ticketDeadline').value || null,
    cost:           parseFloat(document.getElementById('ticketCost').value) || null,
    software_id:    document.getElementById('ticketSoftware').value || null,
    client_id:      document.getElementById('ticketClient').value   || null,
    responsible_id: document.getElementById('ticketResponsible').value || null,
    parent_id:      document.getElementById('ticketLinkedChamado')?.value || null,
    source: 'admin',
  };

  let error;
  if (id) { ({ error } = await _supabase.from('tickets').update(payload).eq('id', id)); }
  else     { ({ error } = await _supabase.from('tickets').insert(payload)); }

  if (error) { showToast(error.message, 'error'); return; }

  // Notificar cliente (se vinculado e status definido)
  if (payload.client_id) {
    const client = S.clients.find(c => c.id === payload.client_id);
    if (client?.user_id && !id) {
      await createNotification(client.user_id,
        'Novo chamado aberto para você',
        `O chamado "${payload.task}" foi criado.`, null);
    }
  }

  showToast(id ? 'Chamado atualizado!' : 'Chamado criado!');
  closeModal('ticketModal');
  await fetchTickets();
  _filteredTickets = [..._allTickets];
  filterTickets();
}

async function askDeleteTicket(id) {
  confirmDelete(`Excluir o chamado #${id}? Ação irreversível.`, async () => {
    const { error } = await _supabase.from('tickets').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Chamado excluído.');
    await fetchTickets();
    _filteredTickets = [..._allTickets];
    renderMondayGrid();
  });
}

// ================================================================
// CONTRATOS
// ================================================================
let _allContracts = [];
let _selectedFile = null;

async function loadContractsPage() {
  await loadClients();
  const { data } = await _supabase.from('contracts')
    .select('*, clients(id,name)')
    .order('created_at', { ascending: false });
  _allContracts = data || [];

  // Popular filtro de clientes
  const sel = document.getElementById('filterContractClient');
  if (sel) {
    sel.innerHTML = '<option value="">Todos clientes</option>' +
      S.clients.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
  }

  filterContracts();
}

function filterContracts() {
  const q      = document.getElementById('contractSearch')?.value.toLowerCase() || '';
  const status = document.getElementById('filterContractStatus')?.value || '';
  const client = document.getElementById('filterContractClient')?.value || '';

  const filtered = _allContracts.filter(c => {
    const matchQ = !q || c.title?.toLowerCase().includes(q) || c.clients?.name?.toLowerCase().includes(q);
    const matchS = !status || c.status === status;
    const matchC = !client || c.client_id === client;
    return matchQ && matchS && matchC;
  });

  renderContractsGrid(filtered);
}

function renderContractsGrid(list) {
  const grid = document.getElementById('contractsGrid');
  if (!grid) return;
  if (!list.length) { grid.innerHTML = '<div class="table-loading">Nenhum contrato encontrado.</div>'; return; }

  grid.innerHTML = list.map(ct => {
    const sc  = ct.status || 'ativo';
    const scl = { ativo:'cs-ativo', pendente:'cs-pendente', expirado:'cs-expirado', cancelado:'cs-cancelado' }[sc] || 'cs-ativo';
    const label = { ativo:'Ativo', pendente:'Pendente', expirado:'Expirado', cancelado:'Cancelado' }[sc] || sc;

    let deadlineHtml = '';
    if (ct.end_date) {
      const days = daysUntil(ct.end_date);
      const cls  = days < 0 ? 'expired' : days <= 30 ? 'near' : 'ok';
      const msg  = days < 0 ? `Vencido há ${Math.abs(days)} dia(s)` : days === 0 ? 'Vence hoje' : `Vence em ${days} dia(s)`;
      deadlineHtml = `<div class="contract-deadline ${cls}"><i class="fas fa-calendar-times"></i> ${msg}</div>`;
    }

    return `
      <div class="contract-card ${sc}">
        <div class="contract-card-top">
          <div class="contract-title">${escHtml(ct.title)}</div>
          <span class="contract-status-badge ${scl}">${label}</span>
        </div>
        <div class="contract-meta">
          ${ct.clients?.name ? `<div class="contract-meta-item"><i class="fas fa-user"></i><strong>${escHtml(ct.clients.name)}</strong></div>` : ''}
          ${ct.value != null ? `<div class="contract-meta-item"><i class="fas fa-dollar-sign"></i> ${formatMoney(ct.value)}</div>` : ''}
          ${ct.start_date ? `<div class="contract-meta-item"><i class="fas fa-calendar-plus"></i> Início: ${formatDate(ct.start_date)}</div>` : ''}
          ${ct.end_date   ? `<div class="contract-meta-item"><i class="fas fa-calendar-times"></i> Venc.: ${formatDate(ct.end_date)}</div>` : ''}
        </div>
        ${deadlineHtml}
        <div class="contract-actions">
          ${ct.file_url ? `<button class="btn btn-outline btn-sm" onclick="downloadContract('${ct.id}','${escHtml(ct.file_path || '')}','${escHtml(ct.file_name || 'contrato')}')"><i class="fas fa-download"></i> Baixar</button>` : '<span></span>'}
          <button class="btn btn-outline btn-sm" onclick="openContractModal('${ct.id}')"><i class="fas fa-pen"></i></button>
          <button class="btn btn-danger btn-sm"  onclick="askDeleteContract('${ct.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
  }).join('');
}

function openContractModal(id) {
  _selectedFile = null;
  const ct = typeof id === 'string' && id ? _allContracts.find(c => c.id === id) : null;

  setEl('contractModalTitle', ct ? 'Editar Contrato' : 'Novo Contrato');
  document.getElementById('contractId').value     = ct?.id || '';
  document.getElementById('contractTitle').value  = ct?.title || '';
  document.getElementById('contractStatus').value = ct?.status || 'ativo';
  document.getElementById('contractValue').value  = ct?.value ?? '';
  document.getElementById('contractStart').value  = ct?.start_date || '';
  document.getElementById('contractEnd').value    = ct?.end_date || '';
  document.getElementById('contractNotes').value  = ct?.notes || '';
  document.getElementById('contractExistingFile').value = ct?.file_path || '';
  document.getElementById('contractFileName').textContent = ct?.file_name || 'Clique ou arraste o arquivo PDF/DOC aqui';

  const clSel = document.getElementById('contractClient');
  clSel.innerHTML = '<option value="">— Selecione —</option>' +
    S.clients.map(c => `<option value="${c.id}" ${c.id === ct?.client_id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('');

  openModal('contractModal');
}

function onContractFileChange(e) {
  _selectedFile = e.target.files[0] || null;
  if (_selectedFile) {
    document.getElementById('contractFileName').textContent = `📎 ${_selectedFile.name}`;
  }
}

async function saveContract(e) {
  e.preventDefault();
  const id     = document.getElementById('contractId').value;
  let filePath = document.getElementById('contractExistingFile').value;
  let fileUrl  = _allContracts.find(c => c.id === id)?.file_url || null;
  let fileName = _allContracts.find(c => c.id === id)?.file_name || null;

  // Upload do arquivo
  if (_selectedFile) {
    const ext  = _selectedFile.name.split('.').pop();
    const path = `contracts/${Date.now()}.${ext}`;
    const { error: upErr } = await _supabase.storage.from('contracts').upload(path, _selectedFile);
    if (upErr) { showToast('Erro no upload: ' + upErr.message, 'error'); return; }

    const { data: signedData } = await _supabase.storage.from('contracts').createSignedUrl(path, 60 * 60 * 24 * 365);
    filePath = path;
    fileUrl  = signedData?.signedUrl || null;
    fileName = _selectedFile.name;
  }

  const payload = {
    title:      document.getElementById('contractTitle').value.trim(),
    status:     document.getElementById('contractStatus').value,
    client_id:  document.getElementById('contractClient').value || null,
    value:      parseFloat(document.getElementById('contractValue').value) || null,
    start_date: document.getElementById('contractStart').value || null,
    end_date:   document.getElementById('contractEnd').value   || null,
    notes:      document.getElementById('contractNotes').value.trim(),
    file_path: filePath || null,
    file_url:  fileUrl  || null,
    file_name: fileName || null,
  };

  let error;
  if (id) { ({ error } = await _supabase.from('contracts').update(payload).eq('id', id)); }
  else     { ({ error } = await _supabase.from('contracts').insert(payload)); }

  if (error) { showToast(error.message, 'error'); return; }
  showToast(id ? 'Contrato atualizado!' : 'Contrato cadastrado!');
  closeModal('contractModal');
  _selectedFile = null;
  await loadContractsPage();
}

async function downloadContract(contractId, filePath, fileName) {
  if (!filePath) { showToast('Arquivo não encontrado.', 'warning'); return; }
  const { data, error } = await _supabase.storage.from('contracts').createSignedUrl(filePath, 60);
  if (error) { showToast('Erro ao gerar link de download.', 'error'); return; }
  const a = document.createElement('a');
  a.href     = data.signedUrl;
  a.download = fileName;
  a.target   = '_blank';
  a.click();
}

async function askDeleteContract(id) {
  confirmDelete('Excluir este contrato? O arquivo vinculado também será removido.', async () => {
    const ct = _allContracts.find(c => c.id === id);
    if (ct?.file_path) {
      await _supabase.storage.from('contracts').remove([ct.file_path]);
    }
    const { error } = await _supabase.from('contracts').delete().eq('id', id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Contrato excluído.');
    await loadContractsPage();
  });
}

// ================================================================
// PERFIL
// ================================================================
async function loadProfilePage() {
  const p = S.profile;
  document.getElementById('profileName').value        = p.name  || '';
  document.getElementById('profileEmail').value       = p.email || '';
  document.getElementById('profilePhone').value       = p.phone || '';
  document.getElementById('profileRoleDisplay').value = ROLE_LABELS[p.role] || p.role;
  const av = p.avatar_url || 'assets/user-generic.svg';
  setImg('profileAvatar', av);
}

async function saveProfile(e) {
  e.preventDefault();
  const payload = {
    name:  document.getElementById('profileName').value.trim(),
    phone: document.getElementById('profilePhone').value.trim(),
  };

  const { error } = await _supabase.from('profiles').update(payload).eq('id', S.user.id);
  if (error) { showToast(error.message, 'error'); return; }

  S.profile = { ...S.profile, ...payload };
  setEl('sidebarName', S.profile.name || S.profile.email);
  setEl('headerName',  (S.profile.name || S.profile.email || '').split(' ')[0]);
  showToast('Perfil atualizado!');
}

async function uploadAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) { showToast('Imagem muito grande. Máximo 2MB.', 'warning'); return; }

  const ext  = file.name.split('.').pop();
  const path = `${S.user.id}/avatar.${ext}`;

  const { error: upErr } = await _supabase.storage.from('avatars').upload(path, file, { upsert: true });
  if (upErr) { showToast('Erro no upload: ' + upErr.message, 'error'); return; }

  const { data } = _supabase.storage.from('avatars').getPublicUrl(path);
  const url = data.publicUrl + '?t=' + Date.now();

  const { error } = await _supabase.from('profiles').update({ avatar_url: url }).eq('id', S.user.id);
  if (error) { showToast(error.message, 'error'); return; }

  S.profile.avatar_url = url;
  ['profileAvatar', 'sidebarAvatar', 'headerAvatar'].forEach(id => setImg(id, url));
  showToast('Foto atualizada!');
}

async function changePassword(e) {
  e.preventDefault();
  const np  = document.getElementById('newPassword').value;
  const cp  = document.getElementById('confirmPassword').value;

  if (np.length < 6)  { showToast('Senha deve ter ao menos 6 caracteres.', 'warning'); return; }
  if (np !== cp)      { showToast('Senhas não conferem.', 'warning'); return; }

  const { error } = await _supabase.auth.updateUser({ password: np });
  if (error) { showToast(error.message, 'error'); return; }

  document.getElementById('newPassword').value     = '';
  document.getElementById('confirmPassword').value = '';
  showToast('Senha alterada com sucesso!');
}

// ================================================================
// MEUS CHAMADOS (Cliente)
// ================================================================
let _myChamados = [];

async function loadMyTicketsPage() {
  const { data } = await _supabase.from('tickets')
    .select('*, software_id, softwares(name), profiles!tickets_responsible_id_fkey(name, avatar_url)')
    .or(`created_by.eq.${S.user.id},client_id.in.(${getMyClientIds()})`)
    .order('id', { ascending: false });

  _myChamados = data || [];
  populateSoftwareFilter('myFilterSoftware');
  renderChamadosList(_myChamados);
}

function getMyClientIds() {
  const mine = S.clients.filter(c => c.user_id === S.user.id);
  return mine.length ? mine.map(c => `"${c.id}"`).join(',') : '""';
}

function filterMyTickets() {
  const q        = document.getElementById('myTicketSearch')?.value.toLowerCase() || '';
  const status   = document.getElementById('myFilterStatus')?.value  || '';
  const software = document.getElementById('myFilterSoftware')?.value || '';
  const filtered = _myChamados.filter(t => {
    const matchQ  = !q || t.task?.toLowerCase().includes(q) || String(t.id).includes(q);
    const matchS  = !status   || t.status === status;
    const matchSW = !software || String(t.software_id) === software;
    return matchQ && matchS && matchSW;
  });
  renderChamadosList(filtered);
}

function renderChamadosList(list) {
  const el = document.getElementById('chamadosList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div style="text-align:center;padding:60px;color:#6b7280">
      <i class="fas fa-headset" style="font-size:40px;margin-bottom:16px;display:block"></i>
      <p>Nenhum chamado encontrado. Clique em "Abrir Chamado" para começar.</p>
    </div>`;
    return;
  }

  el.innerHTML = list.map(t => {
    const sc  = STATUS_CFG[t.status] || STATUS_CFG['não iniciado'];
    const tc  = TYPE_CFG[t.type]     || TYPE_CFG['atendimento'];
    const rp  = t.profiles;
    const rpHtml = rp
      ? `<span style="display:flex;align-items:center;gap:6px;font-size:12px;color:#b0b8d4">
           <img src="${escHtml(rp.avatar_url || 'assets/user-generic.svg')}" style="width:18px;height:18px;border-radius:50%;object-fit:cover"> ${escHtml(rp.name || 'Responsável')}
         </span>`
      : '';
    const reqProfile = S.profiles.find(p => p.id === t.created_by);
    const reqHtml = reqProfile
      ? `<span style="display:flex;align-items:center;gap:6px;font-size:12px;color:#b0b8d4" title="Solicitante">
           <img src="${escHtml(reqProfile.avatar_url || 'assets/user-generic.svg')}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;border:1px solid #00c875">
           <span style="color:#00c875">${escHtml(reqProfile.name || reqProfile.email || 'Solicitante')}</span>
         </span>`
      : '';

    return `<div class="chamado-card" onclick="showTicketDetail(${t.id})">
      <div class="chamado-card-header">
        <span class="chamado-id">#${t.id}</span>
        <span class="badge" style="background:${tc.color}22;color:${tc.color}"><i class="fas ${tc.icon}"></i> ${tc.label}</span>
        <span class="status-badge" style="background:${sc.bg};color:${sc.color};margin-left:auto">${sc.label}</span>
      </div>
      <div class="chamado-title">${escHtml(t.task)}</div>
      ${t.observation ? `<div class="chamado-obs">${escHtml(t.observation)}</div>` : ''}
      <div class="chamado-footer">
        ${t.softwares?.name ? `<span class="badge badge-dev"><i class="fas fa-code"></i> ${escHtml(t.softwares.name)}</span>` : ''}
        ${reqHtml}
        ${rpHtml}
        ${t.deadline ? `<span style="font-size:12px;color:${daysUntil(t.deadline) < 0 ? '#e2445c' : '#b0b8d4'}"><i class="fas fa-calendar"></i> ${formatDate(t.deadline)}</span>` : ''}
        <span class="chamado-date">${formatDate(t.created_at)}</span>
      </div>
    </div>`;
  }).join('');
}

function openChamadoModal() {
  document.getElementById('chamadoTask').value        = '';
  document.getElementById('chamadoType').value        = 'bug';
  document.getElementById('chamadoObservation').value = '';
  openModal('chamadoModal');
}

async function saveChamado(e) {
  e.preventDefault();
  const myClientIds = S.clients.filter(c => c.user_id === S.user.id).map(c => c.id);

  const payload = {
    task:        document.getElementById('chamadoTask').value.trim(),
    type:        document.getElementById('chamadoType').value,
    observation: document.getElementById('chamadoObservation').value.trim(),
    status:      'não iniciado',
    source:      'client',
    created_by:  S.user.id,
    client_id:   myClientIds[0] || null,
  };

  const { error } = await _supabase.from('tickets').insert(payload);
  if (error) { showToast(error.message, 'error'); return; }

  // Notificar equipe
  const staff = S.profiles.filter(p => ['owner', 'employee', 'admin'].includes(p.role));
  await Promise.all(staff.map(a =>
    createNotification(a.id, 'Novo chamado de cliente',
      `"${payload.task}" — ${S.profile.name || S.profile.email}`, null)
  ));

  showToast('Chamado enviado! Nossa equipe entrará em contato em breve.');
  closeModal('chamadoModal');
  await loadMyTicketsPage();
}

function showTicketDetail(ticketId) {
  const t = _myChamados.find(x => x.id === ticketId);
  if (!t) return;

  const sc = STATUS_CFG[t.status] || STATUS_CFG['não iniciado'];
  const tc = TYPE_CFG[t.type]     || TYPE_CFG['atendimento'];

  setEl('detailModalTitle', `Chamado #${t.id}`);

  document.getElementById('ticketDetailBody').innerHTML = `
    <div class="detail-section">
      <div class="detail-grid">
        <div class="detail-item"><label>Status</label>
          <p><span class="status-badge" style="background:${sc.bg};color:${sc.color}">${sc.label}</span></p></div>
        <div class="detail-item"><label>Tipo</label>
          <p><span class="badge" style="background:${tc.color}22;color:${tc.color}">${tc.label}</span></p></div>
        <div class="detail-item"><label>Software</label>
          <p>${escHtml(t.softwares?.name || '—')}</p></div>
        <div class="detail-item"><label>Responsável</label>
          <p>${t.profiles ? escHtml(t.profiles.name || t.profiles.email || '—') : '—'}</p></div>
        <div class="detail-item"><label>Aberto em</label>
          <p>${formatDate(t.created_at)}</p></div>
        <div class="detail-item"><label>Prazo</label>
          <p>${formatDate(t.deadline)}</p></div>
      </div>
    </div>
    ${t.observation ? `
    <div class="detail-section">
      <h4>Descrição</h4>
      <div class="detail-obs">${escHtml(t.observation)}</div>
    </div>` : ''}
  `;

  openModal('ticketDetailModal');
}

// ================================================================
// NOTIFICAÇÕES
// ================================================================
async function loadNotifications() {
  const { data } = await _supabase.from('notifications')
    .select('*')
    .eq('user_id', S.user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  const notifs = data || [];
  renderNotifications(notifs);

  const unread = notifs.filter(n => !n.is_read).length;
  const dot = document.getElementById('notifDot');
  if (dot) dot.style.display = unread > 0 ? '' : 'none';
}

function renderNotifications(notifs) {
  const list = document.getElementById('notifList');
  if (!list) return;
  if (!notifs.length) {
    list.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>Sem notificações</p></div>';
    return;
  }
  list.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="markRead('${n.id}')">
      <div class="notif-icon"><i class="fas fa-bell"></i></div>
      <div class="notif-content">
        <strong>${escHtml(n.title)}</strong>
        <p>${escHtml(n.message || '')}</p>
        <time>${formatDate(n.created_at)}</time>
      </div>
    </div>
  `).join('');
}

function toggleNotifDropdown(e) {
  e.stopPropagation();
  document.getElementById('notifDropdown').classList.toggle('open');
}

async function markRead(id) {
  await _supabase.from('notifications').update({ is_read: true }).eq('id', id);
  await loadNotifications();
}

async function markAllRead() {
  await _supabase.from('notifications').update({ is_read: true }).eq('user_id', S.user.id);
  await loadNotifications();
  document.getElementById('notifDropdown').classList.remove('open');
}

async function createNotification(userId, title, message, ticketId) {
  await _supabase.from('notifications').insert({
    user_id:   userId,
    title,
    message,
    ticket_id: ticketId || null,
  });
}

// ================================================================
// REALTIME (somente admin)
// ================================================================
function subscribeRealtime() {
  S.realtimeCh = _supabase
    .channel('portal_realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${S.user.id}`,
    }, async (payload) => {
      showToast(payload.new.title, 'info');
      await loadNotifications();
      // Atualiza badge no nav
      const badge = document.getElementById('ticketsBadge');
      if (badge) {
        const unread = parseInt(badge.textContent || '0') + 1;
        badge.textContent = unread;
        badge.style.display = '';
      }
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'tickets',
    }, async () => {
      // Recarregar grade se estiver na página de tickets
      if (S.currentPage === 'tickets') {
        await fetchTickets();
        _filteredTickets = [..._allTickets];
        filterTickets();
      }
    })
    .subscribe();
}

// ================================================================
// FUNCIONÁRIOS — Gerenciamento de usuários (somente Owner)
// ================================================================
let _allEmployees = [];

async function loadEmployeesPage() {
  const { data } = await _supabase
    .from('profiles')
    .select('*')
    .in('role', ['owner', 'employee', 'admin'])
    .order('name');
  _allEmployees = data || [];
  renderEmployeesTable(_allEmployees);
}

function filterEmployees() {
  const q = document.getElementById('employeeSearch')?.value.toLowerCase() || '';
  renderEmployeesTable(q
    ? _allEmployees.filter(p =>
        p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q))
    : _allEmployees
  );
}

function renderEmployeesTable(list) {
  const body = document.getElementById('employeesBody');
  if (!body) return;
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="9" class="table-loading">Nenhum funcionário cadastrado.</td></tr>';
    return;
  }

  const permKeys = Object.keys(PERMISSIONS_CFG);

  body.innerHTML = list.map(p => {
    const isMe    = p.id === S.user.id;
    const isOwner = p.role === 'owner';
    const perms   = p.permissions || {};
    const av      = p.avatar_url || 'assets/user-generic.svg';

    const permCells = permKeys.map(k => `
      <td class="perm-cell">
        ${isOwner
          ? '<i class="fas fa-check" style="color:#00c875"></i>'
          : `<input type="checkbox" class="perm-table-check"
               data-uid="${p.id}" data-perm="${k}"
               ${perms[k] ? 'checked' : ''}
               onchange="togglePermission('${p.id}','${k}',this.checked)"
               ${isMe && !isOwner ? 'disabled title="Não pode editar próprias permissões"' : ''}>`
        }
      </td>`).join('');

    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <img src="${escHtml(av)}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid rgba(0,255,136,0.25)" onerror="this.src='assets/user-generic.svg'">
          <div>
            <strong style="display:block">${escHtml(p.name || '—')}</strong>
            <span style="font-size:11px;color:#6b7280">${ROLE_LABELS[p.role] || p.role}</span>
          </div>
        </div>
      </td>
      <td>${escHtml(p.email || '—')}</td>
      <td>${escHtml(p.phone || '—')}</td>
      ${permCells}
      <td>
        <div class="table-actions">
          ${!isOwner && !isMe
            ? `<button class="action-btn delete" onclick="askDeleteEmployee('${p.id}','${escHtml(p.email || '')}')" title="Remover acesso"><i class="fas fa-user-times"></i></button>`
            : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function togglePermission(uid, perm, value) {
  const profile = _allEmployees.find(p => p.id === uid);
  if (!profile) return;
  const newPerms = { ...(profile.permissions || {}), [perm]: value };
  const { error } = await _supabase.from('profiles').update({ permissions: newPerms }).eq('id', uid);
  if (error) { showToast(error.message, 'error'); return; }
  profile.permissions = newPerms;
  showToast('Permissão atualizada!', 'info');
}

function askDeleteEmployee(uid, email) {
  confirmDelete(`Remover acesso de ${email}? O usuário não poderá mais entrar no sistema.`, async () => {
    if (!_supabaseAdmin) {
      showToast('Configure SUPABASE_SERVICE_KEY para remover usuários.', 'error');
      return;
    }
    const { error } = await _supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Usuário removido.');
    await loadEmployeesPage();
  });
}

// ================================================================
// CRIAR USUÁRIO (Owner)
// ================================================================
function openCreateUserModal(type = 'employee') {
  const isEmp = type === 'employee';
  setEl('createUserTitle', isEmp ? 'Novo Funcionário' : 'Novo Acesso de Cliente');
  document.getElementById('newUserRole').value    = type;
  document.getElementById('newUserName').value    = '';
  document.getElementById('newUserEmail').value   = '';
  document.getElementById('newUserPhone').value   = '';
  document.getElementById('newUserPassword').value = '';
  onCreateUserRoleChange();
  renderNewUserPerms();
  openModal('createUserModal');
}

function onCreateUserRoleChange() {
  const role = document.getElementById('newUserRole')?.value;
  const block = document.getElementById('newUserPermBlock');
  if (block) block.style.display = role === 'employee' ? '' : 'none';
}

function renderNewUserPerms() {
  const el = document.getElementById('newUserPermsGrid');
  if (!el) return;
  el.innerHTML = Object.entries(PERMISSIONS_CFG).map(([key, cfg]) => `
    <label class="perm-label">
      <input type="checkbox" id="newPerm_${key}" checked>
      <i class="fas ${cfg.icon}"></i> ${cfg.label}
    </label>
  `).join('');
}

async function createUser(e) {
  e.preventDefault();
  if (!_supabaseAdmin) {
    showToast('Configure SUPABASE_SERVICE_KEY no supabase-config.js para criar usuários.', 'error');
    return;
  }

  const name     = document.getElementById('newUserName').value.trim();
  const email    = document.getElementById('newUserEmail').value.trim();
  const phone    = document.getElementById('newUserPhone').value.trim();
  const password = document.getElementById('newUserPassword').value;
  const role     = document.getElementById('newUserRole').value;

  if (!email || !password) { showToast('E-mail e senha são obrigatórios.', 'warning'); return; }
  if (password.length < 6)  { showToast('Senha deve ter ao menos 6 caracteres.', 'warning'); return; }

  const btn = document.getElementById('createUserBtn');
  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';

  const { data, error } = await _supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error) {
    showToast(error.message, 'error');
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-user-plus"></i> Criar Usuário';
    return;
  }

  // Montar objeto de permissões para funcinários
  let permissions = {};
  if (role === 'employee') {
    Object.keys(PERMISSIONS_CFG).forEach(k => {
      const cb = document.getElementById(`newPerm_${k}`);
      if (cb) permissions[k] = cb.checked;
    });
  }

  // Atualizar perfil (o trigger já cria o registro base)
  await _supabaseAdmin.from('profiles')
    .update({ name, phone, role, permissions })
    .eq('id', data.user.id);

  showToast(`Usuário ${email} criado com sucesso!`);
  closeModal('createUserModal');
  btn.disabled  = false;
  btn.innerHTML = '<i class="fas fa-user-plus"></i> Criar Usuário';

  if (S.currentPage === 'employees') await loadEmployeesPage();
  if (S.currentPage === 'clients'  ) await loadClientsPage();
}

// ================================================================
// CONFIGURAÇÕES — Segurança
// ================================================================
function loadSettingsPage() {
  // Limpar os campos ao entrar na página
  const f1 = document.getElementById('settNewPassword');
  const f2 = document.getElementById('settConfirmPassword');
  if (f1) f1.value = '';
  if (f2) f2.value = '';
}

async function changeSettingsPassword(e) {
  e.preventDefault();
  const np = document.getElementById('settNewPassword').value;
  const cp = document.getElementById('settConfirmPassword').value;

  if (np.length < 6) { showToast('Senha deve ter ao menos 6 caracteres.', 'warning'); return; }
  if (np !== cp)     { showToast('Senhas não conferem.', 'warning'); return; }

  const { error } = await _supabase.auth.updateUser({ password: np });
  if (error) { showToast(error.message, 'error'); return; }

  document.getElementById('settNewPassword').value    = '';
  document.getElementById('settConfirmPassword').value = '';
  showToast('Senha alterada com sucesso!');
}

