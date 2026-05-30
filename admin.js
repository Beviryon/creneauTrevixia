/**
 * PFF — Page administration
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

const modal = document.getElementById('detail-modal');
const modalContent = document.getElementById('modal-content');
const modalEmailLink = document.getElementById('modal-email-link');

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
  const booked = reservations.length;
  const available = PFFStorage.TOTAL_SLOTS - booked;
  const rate = Math.round((booked / PFFStorage.TOTAL_SLOTS) * 100);

  document.getElementById('stat-total').textContent = booked;
  document.getElementById('stat-available').textContent = available;
  document.getElementById('stat-rate').textContent = `${rate}%`;
}

function renderSlotsGrid() {
  const grid = document.getElementById('admin-slots-grid');
  const reservations = PFFStorage.getReservations();
  const reservationMap = new Map(reservations.map((r) => [r.slot, r]));
  grid.innerHTML = '';

  PFFStorage.SLOTS.forEach((slot) => {
    const reservation = reservationMap.get(slot);
    const parsed = PFFStorage.parseSlot(slot);
    const isTaken = Boolean(reservation);

    const cell = document.createElement('article');
    cell.className = `admin-slot-cell${isTaken ? ' admin-slot-cell--taken admin-slot-cell--clickable' : ' admin-slot-cell--free'}`;

    if (isTaken) {
      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', `Voir la réservation de ${reservation.fullName}`);
      cell.dataset.slot = slot;
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

function handleDebugReset() {
  if (confirm('Réinitialiser toutes les réservations (localStorage) ?')) {
    PFFStorage.clearAll();
    location.reload();
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

function render() {
  const reservations = PFFStorage.getReservations();
  updateStats(reservations);
  renderSlotsGrid();
  renderTable();
}

const adminGate = document.getElementById('admin-gate');
const adminDashboard = document.getElementById('admin-dashboard');
const adminLoginForm = document.getElementById('admin-login-form');
const adminLoginError = document.getElementById('admin-login-error');

function showAdminGate() {
  adminGate.hidden = false;
  adminDashboard.hidden = true;
  PFFStorage.clearAdminSession();
}

function showAdminDashboard() {
  adminGate.hidden = true;
  adminDashboard.hidden = false;
  render();
}

function handleAdminLogin(event) {
  event.preventDefault();
  adminLoginError.hidden = true;

  const pin = document.getElementById('admin-pin').value;
  if (!PFFStorage.verifyAdminPin(pin)) {
    adminLoginError.textContent = 'Code incorrect. Accès refusé.';
    adminLoginError.hidden = false;
    document.getElementById('admin-pin').value = '';
    document.getElementById('admin-pin').focus();
    return;
  }

  PFFStorage.setAdminAuthenticated();
  document.getElementById('admin-pin').value = '';
  showAdminDashboard();
}

function handleAdminLogout() {
  PFFStorage.clearAdminSession();
  showAdminGate();
}

document.addEventListener('DOMContentLoaded', () => {
  initModal();
  adminLoginForm.addEventListener('submit', handleAdminLogin);

  if (PFFStorage.isAdminAuthenticated()) {
    showAdminDashboard();
  } else {
    showAdminGate();
  }

  document.getElementById('admin-logout').addEventListener('click', handleAdminLogout);
  document.getElementById('export-csv').addEventListener('click', exportCSV);
  document.getElementById('debug-reset').addEventListener('click', handleDebugReset);
});
