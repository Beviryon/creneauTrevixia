/**
 * PFF — Page de confirmation
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

function renderBooking() {
  const booking = PFFStorage.getMyBooking();
  if (!booking) {
    window.location.replace('index.html');
    return;
  }

  const parsed = PFFStorage.parseSlot(booking.slot);
  document.getElementById('ticket-day').textContent = parsed.day;
  document.getElementById('ticket-time').textContent = `${parsed.start} – ${parsed.end}`;

  const rows = [
    { label: 'Nom', value: booking.fullName },
    { label: 'E-mail', value: booking.email },
    { label: 'Marque', value: booking.brand },
    { label: 'Réservé le', value: formatDate(booking.bookedAt || booking.date) },
  ];

  document.getElementById('ticket-details').innerHTML = rows
    .map((row) => `
      <div class="ticket__row">
        <dt>${escapeHtml(row.label)}</dt>
        <dd>${escapeHtml(row.value)}</dd>
      </div>
    `)
    .join('');
}

async function handleCancelBooking() {
  const booking = PFFStorage.getMyBooking();
  if (!booking) {
    window.location.replace('index.html');
    return;
  }

  const parsed = PFFStorage.parseSlot(booking.slot);
  const message = `Annuler votre créneau du ${parsed.day} (${parsed.start} – ${parsed.end}) ?`;

  if (!confirm(message)) return;

  try {
    const ok = await PFFStorage.cancelMyBooking();
    if (!ok) {
      alert('Impossible d\'annuler. Réessayez.');
      return;
    }
    window.location.replace('index.html');
  } catch {
    alert('Erreur de connexion. Réessayez.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderBooking();
  document.getElementById('cancel-booking').addEventListener('click', handleCancelBooking);
});
