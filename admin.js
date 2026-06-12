/**
 * PFF — Page administration (Firebase Auth)
 */
'use strict';

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getAuth() {
  if (!firebase.apps.length) {
    firebase.initializeApp(window.PFF_CONFIG.firebase);
  }
  return firebase.auth();
}

function getAdminEmails() {
  return (window.PFF_CONFIG.adminEmails || []).map((e) => e.toLowerCase());
}

function isAdminUser(user) {
  return Boolean(user && getAdminEmails().includes(user.email.toLowerCase()));
}

function authErrorMessage(code) {
  const messages = {
    'auth/invalid-email': 'Adresse e-mail invalide.',
    'auth/user-disabled': 'Ce compte a été désactivé.',
    'auth/user-not-found': 'Identifiants incorrects.',
    'auth/wrong-password': 'Identifiants incorrects.',
    'auth/invalid-credential': 'Identifiants incorrects.',
    'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
  };
  return messages[code] || 'Connexion impossible. Vérifiez vos identifiants.';
}

const modal = document.getElementById('detail-modal');
const modalContent = document.getElementById('modal-content');
const modalEmailLink = document.getElementById('modal-email-link');
const adminGate = document.getElementById('admin-gate');
const adminDashboard = document.getElementById('admin-dashboard');
const adminLoginForm = document.getElementById('admin-login-form');
const adminLoginError = document.getElementById('admin-login-error');
const adminUserEmail = document.getElementById('admin-user-email');
const adminSlotsInput = document.getElementById('admin-slots-input');
const adminSlotsMessage = document.getElementById('admin-slots-message');
const adminSaveSlotsBtn = document.getElementById('admin-save-slots');

function openDetailModal(reservation) {
  const parsed = PFFStorage.parseSlot(reservation.slot);

  modalContent.innerHTML = `
    <div class="modal-detail">
      <div class="modal-detail__slot">
        <span class="modal-detail__slot-label">Créneau</span>
        <p class="modal-detail__slot-day">${escapeHtml(parsed.day)}</p>
        <p class="modal-detail__slot-time">${escapeHtml(parsed.start)} – ${escapeHtml(parsed.end)}</p>
      </div>
      <dl class="modal-detail__list">
        <div class="modal-detail__row">
          <dt>Nom complet</dt>
          <dd>${escapeHtml(reservation.fullName)}</dd>
        </div>
        <div class="modal-detail__row">
          <dt>Adresse e-mail</dt>
          <dd><a href="mailto:${escapeHtml(reservation.email)}">${escapeHtml(reservation.email)}</a></dd>
        </div>
        <div class="modal-detail__row">
          <dt>Marque fictive</dt>
          <dd>${escapeHtml(reservation.brand)}</dd>
        </div>
        <div class="modal-detail__row">
          <dt>Réservé le</dt>
          <dd>${escapeHtml(formatDate(reservation.date))}</dd>
        </div>
      </dl>
    </div>
  `;

  modalEmailLink.href = `mailto:${encodeURIComponent(reservation.email)}`;
  modalEmailLink.textContent = `Contacter ${reservation.fullName.split(' ')[0]}`;

  modal.hidden = false;
  document.body.classList.add('modal-open');
  modal.querySelector('.modal__close').focus();
}

function closeDetailModal() {
  modal.hidden = true;
  document.body.classList.remove('modal-open');
}

function updateStats(reservations) {
  const totalSlots = PFFStorage.TOTAL_SLOTS;
  const booked = reservations.length;
  const available = Math.max(totalSlots - booked, 0);
  const rate = totalSlots > 0 ? Math.round((booked / totalSlots) * 100) : 0;

  document.getElementById('stat-total').textContent = booked;
  document.getElementById('stat-available').textContent = available;
  document.getElementById('stat-rate').textContent = `${rate}%`;
}

function renderSlotsGrid() {
  const grid = document.getElementById('admin-slots-grid');
  const reservations = PFFStorage.getReservations();
  const reservationMap = new Map(reservations.map((r) => [r.slot, r]));
  grid.innerHTML = '';

  PFFStorage.getSlots().forEach((slot) => {
    const reservation = reservationMap.get(slot);
    const parsed = PFFStorage.parseSlot(slot);
    const isTaken = Boolean(reservation);

    const cell = document.createElement('article');
    cell.className = `admin-slot-cell${isTaken ? ' admin-slot-cell--taken admin-slot-cell--clickable' : ' admin-slot-cell--free'}`;

    if (isTaken) {
      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', `Voir la réservation de ${reservation.fullName}`);
    }

    cell.innerHTML = `
      <header class="admin-slot-cell__header">
        <span class="admin-slot-cell__day">${escapeHtml(parsed.day)}</span>
        <span class="admin-slot-cell__badge">${isTaken ? 'Réservé' : 'Libre'}</span>
      </header>
      <p class="admin-slot-cell__time">${escapeHtml(parsed.start)} – ${escapeHtml(parsed.end)}</p>
      ${
        isTaken
          ? `<div class="admin-slot-cell__student">
              <strong>${escapeHtml(reservation.fullName)}</strong>
              <span>${escapeHtml(reservation.brand)}</span>
              <span class="admin-slot-cell__hint">Cliquer pour voir les détails</span>
            </div>`
          : '<p class="admin-slot-cell__empty">—</p>'
      }
    `;

    if (isTaken) {
      cell.addEventListener('click', () => openDetailModal(reservation));
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetailModal(reservation);
        }
      });
    }

    grid.appendChild(cell);
  });
}

function parseSlotsInput(value) {
  const rows = value
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  return Array.from(new Set(rows));
}

function showSlotsMessage(message, isError) {
  adminSlotsMessage.textContent = message;
  adminSlotsMessage.hidden = false;
  adminSlotsMessage.className = `alert ${isError ? 'alert--error' : 'alert--success'}`;
}

function renderSlotsEditor() {
  adminSlotsInput.value = PFFStorage.getSlots().join('\n');
  adminSlotsMessage.hidden = true;
}

function renderTable() {
  const tbody = document.getElementById('admin-table-body');
  const emptyMsg = document.getElementById('admin-empty');
  const table = document.getElementById('admin-table');
  const reservations = PFFStorage.getReservations();

  tbody.innerHTML = '';

  if (reservations.length === 0) {
    table.hidden = true;
    emptyMsg.hidden = false;
    return;
  }

  table.hidden = false;
  emptyMsg.hidden = true;

  reservations.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.className = 'admin-table__row--clickable';
    tr.setAttribute('role', 'button');
    tr.setAttribute('tabindex', '0');
    tr.setAttribute('aria-label', `Voir la réservation de ${r.fullName}`);

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><span class="admin-table__slot">${escapeHtml(r.slot)}</span></td>
      <td>${escapeHtml(r.fullName)}</td>
      <td>${escapeHtml(r.email)}</td>
      <td>${escapeHtml(r.brand)}</td>
      <td class="admin-table__date">${escapeHtml(formatDate(r.date))}</td>
    `;

    tr.addEventListener('click', () => openDetailModal(r));
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetailModal(r);
      }
    });

    tbody.appendChild(tr);
  });
}

function exportCSV() {
  const reservations = PFFStorage.getReservations();
  if (reservations.length === 0) {
    alert('Aucune réservation à exporter.');
    return;
  }

  const headers = ['Créneau', 'Nom', 'E-mail', 'Marque', 'Date réservation'];
  const rows = reservations.map((r) =>
    [r.slot, r.fullName, r.email, r.brand, r.date]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pff-reservations-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleDebugReset() {
  if (!confirm('Réinitialiser toutes les réservations ?')) return;
  try {
    await PFFStorage.clearAll();
    location.reload();
  } catch {
    alert('Erreur lors de la réinitialisation.');
  }
}

function initModal() {
  modal.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', closeDetailModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeDetailModal();
  });
}

async function render() {
  await PFFStorage.init();
  const reservations = PFFStorage.getReservations();
  updateStats(reservations);
  renderSlotsGrid();
  renderTable();
  renderSlotsEditor();
}

async function handleSaveSlots() {
  const nextSlots = parseSlotsInput(adminSlotsInput.value);
  if (nextSlots.length === 0) {
    showSlotsMessage('Ajoutez au moins un créneau.', true);
    return;
  }

  const reservations = PFFStorage.getReservations();
  const reservedSlots = new Set(reservations.map((r) => r.slot));
  const removedReserved = Array.from(reservedSlots).filter((slot) => !nextSlots.includes(slot));
  if (removedReserved.length > 0) {
    showSlotsMessage('Impossible de supprimer des créneaux déjà réservés. Annulez d\'abord ces réservations.', true);
    return;
  }

  adminSaveSlotsBtn.disabled = true;
  adminSaveSlotsBtn.textContent = 'Enregistrement…';
  try {
    const result = await PFFStorage.setSlots(nextSlots);
    if (!result.ok) {
      if (result.error === 'PERMISSION') {
        showSlotsMessage('Permissions Firestore insuffisantes. Publiez les règles mises à jour dans firebase/firestore.rules.', true);
      } else {
        showSlotsMessage('Impossible d\'enregistrer les créneaux.', true);
      }
      return;
    }
    await render();
    showSlotsMessage('Créneaux enregistrés avec succès.', false);
  } catch (err) {
    console.error(err);
    showSlotsMessage('Erreur réseau lors de l\'enregistrement.', true);
  } finally {
    adminSaveSlotsBtn.disabled = false;
    adminSaveSlotsBtn.textContent = 'Enregistrer les créneaux';
  }
}

function showAdminGate(message) {
  adminGate.hidden = false;
  adminDashboard.hidden = true;
  adminUserEmail.hidden = true;
  if (message) {
    adminLoginError.textContent = message;
    adminLoginError.hidden = false;
  } else {
    adminLoginError.hidden = true;
  }
}

function showAdminDashboard(user) {
  adminGate.hidden = true;
  adminDashboard.hidden = false;
  adminUserEmail.textContent = `Connecté : ${user.email}`;
  adminUserEmail.hidden = false;
  render().catch((err) => {
    console.error(err);
    alert('Impossible de charger les réservations.');
  });
}

async function handleAdminLogin(event) {
  event.preventDefault();
  adminLoginError.hidden = true;

  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;

  if (getAdminEmails().length === 0) {
    adminLoginError.textContent = 'Aucun e-mail admin configuré dans config.js (adminEmails).';
    adminLoginError.hidden = false;
    return;
  }

  try {
    await getAuth().signInWithEmailAndPassword(email, password);
  } catch (err) {
    adminLoginError.textContent = authErrorMessage(err.code);
    adminLoginError.hidden = false;
  }
}

async function handleAdminLogout() {
  await getAuth().signOut();
}

document.addEventListener('DOMContentLoaded', () => {
  initModal();
  adminLoginForm.addEventListener('submit', handleAdminLogin);

  getAuth().onAuthStateChanged(async (user) => {
    if (user && isAdminUser(user)) {
      showAdminDashboard(user);
    } else if (user) {
      await getAuth().signOut();
      showAdminGate('Ce compte n\'a pas les droits administrateur.');
    } else {
      showAdminGate();
    }
  });

  document.getElementById('admin-logout').addEventListener('click', handleAdminLogout);
  document.getElementById('export-csv').addEventListener('click', exportCSV);
  document.getElementById('debug-reset').addEventListener('click', handleDebugReset);
  adminSaveSlotsBtn.addEventListener('click', handleSaveSlots);
});
