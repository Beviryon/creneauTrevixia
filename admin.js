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
const deleteSlotsModal = document.getElementById('delete-slots-modal');
const deleteSlotsList = document.getElementById('delete-slots-list');
const deleteSlotsConfirmBtn = document.getElementById('delete-slots-confirm');
const adminGate = document.getElementById('admin-gate');
const adminDashboard = document.getElementById('admin-dashboard');
const adminLoginForm = document.getElementById('admin-login-form');
const adminLoginError = document.getElementById('admin-login-error');
const adminUserEmail = document.getElementById('admin-user-email');
const adminSlotBuilderForm = document.getElementById('admin-slot-builder-form');
const adminSlotDate = document.getElementById('admin-slot-date');
const adminSlotStart = document.getElementById('admin-slot-start');
const adminSlotEnd = document.getElementById('admin-slot-end');
const adminSlotsList = document.getElementById('admin-slots-list');
const adminSlotsCount = document.getElementById('admin-slots-count');
const adminSlotsMessage = document.getElementById('admin-slots-message');
const adminSaveSlotsBtn = document.getElementById('admin-save-slots');
const adminClearSlotsBtn = document.getElementById('admin-clear-slots');

let adminSlotsDraft = [];
let deleteSlotsModalResolver = null;

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

function closeDeleteSlotsModal(confirmed) {
  if (deleteSlotsModal.hidden) return;
  deleteSlotsModal.hidden = true;
  document.body.classList.remove('modal-open');
  if (deleteSlotsModalResolver) {
    const resolve = deleteSlotsModalResolver;
    deleteSlotsModalResolver = null;
    resolve(Boolean(confirmed));
  }
}

function requestDeleteSlotsConfirmation(slots) {
  const maxVisible = 6;
  deleteSlotsList.innerHTML = '';
  slots.slice(0, maxVisible).forEach((slot) => {
    const li = document.createElement('li');
    li.textContent = slot;
    deleteSlotsList.appendChild(li);
  });
  if (slots.length > maxVisible) {
    const li = document.createElement('li');
    li.textContent = `…et ${slots.length - maxVisible} autre(s)`;
    deleteSlotsList.appendChild(li);
  }

  deleteSlotsModal.hidden = false;
  document.body.classList.add('modal-open');
  deleteSlotsConfirmBtn.focus();

  return new Promise((resolve) => {
    deleteSlotsModalResolver = resolve;
  });
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

function showSlotsMessage(message, isError) {
  adminSlotsMessage.textContent = message;
  adminSlotsMessage.hidden = false;
  adminSlotsMessage.className = `alert ${isError ? 'alert--error' : 'alert--success'}`;
}

function normalizeSlots(slots) {
  const list = slots
    .map((slot) => String(slot || '').trim())
    .filter(Boolean);
  return Array.from(new Set(list));
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toHourLabel(value) {
  const [hour, minute] = String(value).split(':');
  return `${pad2(hour)}h${pad2(minute)}`;
}

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildSlotLabel(dateValue, startValue, endValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const weekday = capitalize(date.toLocaleDateString('fr-FR', { weekday: 'long' }));
  const month = capitalize(date.toLocaleDateString('fr-FR', { month: 'long' }));
  const day = date.getDate() === 1 ? '1er' : String(date.getDate());
  return `${weekday} ${day} ${month} – ${toHourLabel(startValue)} à ${toHourLabel(endValue)}`;
}

function getReservedSlotsSet() {
  return new Set(PFFStorage.getReservations().map((r) => r.slot));
}

function renderSlotsDraftList() {
  const reservedSlots = getReservedSlotsSet();
  adminSlotsCount.textContent = String(adminSlotsDraft.length);
  adminSlotsList.innerHTML = '';

  if (adminSlotsDraft.length === 0) {
    adminSlotsList.innerHTML = '<p class="admin-slots-list__empty">Aucun créneau pour le moment.</p>';
    return;
  }

  adminSlotsDraft.forEach((slot) => {
    const parsed = PFFStorage.parseSlot(slot);
    const isReserved = reservedSlots.has(slot);
    const row = document.createElement('article');
    row.className = 'admin-slots-list__item';
    row.innerHTML = `
      <div class="admin-slots-list__meta">
        <p class="admin-slots-list__day">${escapeHtml(parsed.day)}</p>
        <p class="admin-slots-list__time">${escapeHtml(parsed.start)} – ${escapeHtml(parsed.end)}</p>
      </div>
      <div class="admin-slots-list__actions">
        ${isReserved ? '<span class="admin-slots-list__badge">Réservé</span>' : ''}
        <button type="button" class="btn btn--ghost btn--sm admin-slots-list__remove" data-slot="${escapeHtml(slot)}">
          Supprimer
        </button>
      </div>
    `;
    row.querySelector('.admin-slots-list__remove').addEventListener('click', () => {
      adminSlotsDraft = adminSlotsDraft.filter((value) => value !== slot);
      renderSlotsDraftList();
      if (isReserved) {
        showSlotsMessage('Créneau réservé retiré de la liste. La réservation liée sera supprimée à l\'enregistrement.', false);
      } else {
        showSlotsMessage('Créneau retiré de la liste.', false);
      }
    });

    adminSlotsList.appendChild(row);
  });
}

function renderSlotsEditor() {
  adminSlotsDraft = normalizeSlots(PFFStorage.getSlots());
  renderSlotsDraftList();
  adminSlotsMessage.hidden = true;
  if (!adminSlotDate.value) {
    adminSlotDate.value = new Date().toISOString().slice(0, 10);
  }
  if (!adminSlotStart.value) adminSlotStart.value = '19:30';
  if (!adminSlotEnd.value) adminSlotEnd.value = '20:05';
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

  deleteSlotsModal.querySelectorAll('[data-close-delete-modal]').forEach((el) => {
    el.addEventListener('click', () => closeDeleteSlotsModal(false));
  });
  deleteSlotsConfirmBtn.addEventListener('click', () => closeDeleteSlotsModal(true));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeDetailModal();
    if (e.key === 'Escape' && !deleteSlotsModal.hidden) closeDeleteSlotsModal(false);
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

function handleSlotBuilderSubmit(event) {
  event.preventDefault();
  adminSlotsMessage.hidden = true;

  const dateValue = adminSlotDate.value;
  const startValue = adminSlotStart.value;
  const endValue = adminSlotEnd.value;

  if (!dateValue || !startValue || !endValue) {
    showSlotsMessage('Complétez date, heure de début et heure de fin.', true);
    return;
  }

  if (startValue >= endValue) {
    showSlotsMessage('L\'heure de fin doit être après l\'heure de début.', true);
    return;
  }

  const slotLabel = buildSlotLabel(dateValue, startValue, endValue);
  if (!slotLabel) {
    showSlotsMessage('Date invalide.', true);
    return;
  }

  if (adminSlotsDraft.includes(slotLabel)) {
    showSlotsMessage('Ce créneau existe déjà dans la liste.', true);
    return;
  }

  adminSlotsDraft = [...adminSlotsDraft, slotLabel];
  renderSlotsDraftList();
  showSlotsMessage('Créneau ajouté.', false);

  // Conserve la date pour accélérer la saisie en série.
  adminSlotStart.value = '';
  adminSlotEnd.value = '';
  adminSlotStart.focus();
}

function handleClearSlots() {
  if (adminSlotsDraft.length === 0) {
    showSlotsMessage('La liste est déjà vide.', true);
    return;
  }

  adminSlotsDraft = [];
  renderSlotsDraftList();
  showSlotsMessage('Tous les créneaux ont été retirés de la liste.', false);
}

async function handleSaveSlots() {
  const nextSlots = normalizeSlots(adminSlotsDraft);
  if (nextSlots.length === 0) {
    showSlotsMessage('Ajoutez au moins un créneau.', true);
    return;
  }

  const reservations = PFFStorage.getReservations();
  const reservedSlots = new Set(reservations.map((r) => r.slot));
  const removedReserved = Array.from(reservedSlots).filter((slot) => !nextSlots.includes(slot));

  adminSaveSlotsBtn.disabled = true;
  adminSaveSlotsBtn.textContent = 'Enregistrement…';
  try {
    if (removedReserved.length > 0) {
      const confirmDelete = await requestDeleteSlotsConfirmation(removedReserved);
      if (!confirmDelete) {
        showSlotsMessage('Enregistrement annulé.', true);
        return;
      }
      const deleteResult = await PFFStorage.deleteReservationsBySlots(removedReserved);
      if (!deleteResult.ok) {
        if (deleteResult.error === 'PERMISSION') {
          showSlotsMessage('Permissions insuffisantes pour supprimer les réservations liées.', true);
        } else {
          showSlotsMessage('Impossible de supprimer les réservations liées.', true);
        }
        return;
      }
    }

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
  adminSlotBuilderForm.addEventListener('submit', handleSlotBuilderSubmit);
  adminClearSlotsBtn.addEventListener('click', handleClearSlots);
  adminSaveSlotsBtn.addEventListener('click', handleSaveSlots);
});
