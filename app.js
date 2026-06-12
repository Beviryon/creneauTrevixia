/**
 * Réservation PFF — Page de réservation
 */
'use strict';

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function shortDayLabel(day) {
  const parts = day.split(' ');
  const weekday = parts[0].slice(0, 3);
  const dayNum = parts[1].replace('er', '');
  const month = parts[2] || '';
  return `${weekday}. ${dayNum} ${month}`;
}

const reservationForm = document.getElementById('reservation-form');
const dayTabsEl = document.getElementById('day-tabs');
const slotsContainer = document.getElementById('slots-container');
const slotsCounter = document.getElementById('slots-counter');
const availabilityFill = document.getElementById('availability-fill');
const availabilityProgress = document.getElementById('availability-progress');
const errorMessage = document.getElementById('error-message');
const selectedPreview = document.getElementById('selected-preview');
const selectedPreviewText = document.getElementById('selected-preview-text');
const stickyLabel = document.getElementById('sticky-label');
const stickyValue = document.getElementById('sticky-value');
const stickySubmit = document.getElementById('sticky-submit');

let activeDayIndex = 0;
let dayGroups = [];

function isMobileView() {
  return window.matchMedia('(max-width: 767px)').matches;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
  errorMessage.hidden = true;
  errorMessage.textContent = '';
}

function updateAvailabilityUI(reservedCount) {
  const available = PFFStorage.TOTAL_SLOTS - reservedCount;
  const pct = (available / PFFStorage.TOTAL_SLOTS) * 100;

  slotsCounter.textContent = `${available} / ${PFFStorage.TOTAL_SLOTS} libres`;
  availabilityFill.style.width = `${pct}%`;
  availabilityProgress.setAttribute('aria-valuenow', String(available));
  availabilityProgress.setAttribute('aria-valuetext', `${available} créneaux disponibles`);
}

function updateSelectedPreview(slotValue) {
  if (!slotValue) {
    selectedPreview.hidden = true;
    selectedPreviewText.textContent = '';
    stickyLabel.textContent = 'Aucun créneau sélectionné';
    stickyValue.textContent = '';
    stickySubmit.disabled = true;
    stickySubmit.textContent = 'Réserver';
    return;
  }

  const parsed = PFFStorage.parseSlot(slotValue);
  const text = `${parsed.day} · ${parsed.start} – ${parsed.end}`;

  selectedPreviewText.textContent = text;
  selectedPreview.hidden = false;

  stickyLabel.textContent = 'Créneau sélectionné';
  stickyValue.textContent = `${parsed.start} – ${parsed.end} · ${shortDayLabel(parsed.day)}`;
  stickySubmit.disabled = false;
  stickySubmit.textContent = 'Confirmer';
}

function getCheckedSlotValue() {
  const checked = reservationForm.querySelector('input[name="slot"]:checked');
  return checked ? checked.value : null;
}

function renderDayTabs() {
  const reservedSlots = PFFStorage.getReservedSlots();
  dayTabsEl.innerHTML = '';

  dayGroups.forEach((group, i) => {
    const freeCount = group.slots.filter((s) => !reservedSlots.has(s.slot)).length;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `day-tab${i === activeDayIndex ? ' day-tab--active' : ''}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(i === activeDayIndex));
    btn.setAttribute('aria-controls', `day-panel-${i}`);
    btn.innerHTML = `
      <span class="day-tab__label">${escapeHtml(shortDayLabel(group.day))}</span>
      <span class="day-tab__count">${freeCount} libre${freeCount > 1 ? 's' : ''}</span>
    `;
    btn.addEventListener('click', () => {
      activeDayIndex = i;
      renderAll(false);
    });
    dayTabsEl.appendChild(btn);
  });
}

function buildSlotRow({ slot, index, parsed }, isReserved) {
  const slotId = `slot-${index}`;
  const row = document.createElement('div');
  row.className = `slot-row${isReserved ? ' slot-row--taken' : ''}`;

  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'slot';
  input.id = slotId;
  input.value = slot;
  input.className = 'slot-row__input';
  if (isReserved) input.disabled = true;
  if (getCheckedSlotValue() === slot) input.checked = true;

  const label = document.createElement('label');
  label.className = 'slot-row__label';
  label.setAttribute('for', slotId);
  label.innerHTML = `
    <span class="slot-row__radio" aria-hidden="true"></span>
    <span class="slot-row__time">${escapeHtml(parsed.start)}<span class="slot-row__dash">–</span>${escapeHtml(parsed.end)}</span>
    <span class="slot-row__badge ${isReserved ? 'slot-row__badge--taken' : 'slot-row__badge--free'}">
      ${isReserved ? 'Complet' : 'Libre'}
    </span>
  `;

  row.appendChild(input);
  row.appendChild(label);

  if (!isReserved) {
    input.addEventListener('change', () => {
      if (input.checked) updateSelectedPreview(input.value);
    });
  }

  return row;
}

function renderSlots() {
  const reservedSlots = PFFStorage.getReservedSlots();
  const previousSelection = getCheckedSlotValue();
  slotsContainer.innerHTML = '';

  const groupsToShow = isMobileView()
    ? [dayGroups[activeDayIndex]]
    : dayGroups;

  groupsToShow.forEach((group, gi) => {
    const realIndex = isMobileView() ? activeDayIndex : gi;

    if (!isMobileView()) {
      const dayTitle = document.createElement('h3');
      dayTitle.className = 'slot-list__day';
      dayTitle.id = `day-panel-${realIndex}`;
      dayTitle.textContent = group.day;
      slotsContainer.appendChild(dayTitle);
    } else {
      const dayTitle = document.createElement('p');
      dayTitle.className = 'slot-list__day slot-list__day--mobile';
      dayTitle.id = `day-panel-${realIndex}`;
      dayTitle.textContent = group.day;
      slotsContainer.appendChild(dayTitle);
    }

    const list = document.createElement('div');
    list.className = 'slot-list__group';

    group.slots.forEach((slotData) => {
      const isReserved = reservedSlots.has(slotData.slot);
      list.appendChild(buildSlotRow(slotData, isReserved));
    });

    slotsContainer.appendChild(list);
  });

  updateAvailabilityUI(reservedSlots.size);

  if (previousSelection) {
    updateSelectedPreview(previousSelection);
  }
}

function renderAll(resetTabs = true) {
  dayGroups = PFFStorage.groupSlotsByDay();
  if (resetTabs) {
    activeDayIndex = 0;
  }
  renderDayTabs();
  renderSlots();
}

function validateForm() {
  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();
  const brand = document.getElementById('brand').value.trim();
  const selectedSlot = reservationForm.querySelector('input[name="slot"]:checked');

  if (!fullName) {
    showError('Veuillez renseigner votre nom complet.');
    document.getElementById('fullName').focus();
    return null;
  }
  if (!email) {
    showError('Veuillez renseigner votre adresse e-mail.');
    document.getElementById('email').focus();
    return null;
  }
  if (!isValidEmail(email)) {
    showError('L\'adresse e-mail saisie n\'est pas valide.');
    document.getElementById('email').focus();
    return null;
  }
  if (!brand) {
    showError('Veuillez renseigner le nom de votre marque fictive.');
    document.getElementById('brand').focus();
    return null;
  }
  if (!selectedSlot) {
    showError('Veuillez sélectionner un créneau.');
    document.getElementById('panel-slots').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return null;
  }

  if (PFFStorage.getReservedSlots().has(selectedSlot.value)) {
    showError('Ce créneau vient d\'être pris. Choisissez-en un autre.');
    renderAll(false);
    return null;
  }

  return { fullName, email, brand, slot: selectedSlot.value };
}

function setLoading(loading) {
  slotsContainer.classList.toggle('slot-list--loading', loading);
  stickySubmit.disabled = loading || !getCheckedSlotValue();
}

function saveErrorMessage(code) {
  const messages = {
    SLOT_TAKEN: 'Ce créneau vient d\'être pris par un autre candidat. Choisissez-en un autre.',
    SLOT_INVALID: 'Ce créneau n\'est plus disponible. Rechargez la page pour voir la nouvelle planification.',
    EMAIL_TAKEN: 'Cette adresse e-mail a déjà une réservation active.',
    NETWORK: 'Erreur de connexion au serveur. Vérifiez votre réseau et réessayez.',
  };
  showError(messages[code] || 'Impossible d\'enregistrer la réservation.');
}

async function handleSubmit(event) {
  event.preventDefault();
  hideError();

  const data = validateForm();
  if (!data) return;

  stickySubmit.disabled = true;
  stickySubmit.textContent = 'Envoi…';

  try {
    const result = await PFFStorage.saveReservation({
      slot: data.slot,
      fullName: data.fullName,
      email: data.email,
      brand: data.brand,
    });

    if (!result.ok) {
      saveErrorMessage(result.error);
      await renderAll(false);
      return;
    }

    PFFStorage.setMyBooking(data);
    window.location.replace('confirmation.html');
  } catch (err) {
    console.error(err);
    showError('Erreur inattendue. Réessayez dans quelques instants.');
  } finally {
    stickySubmit.disabled = !getCheckedSlotValue();
    stickySubmit.textContent = getCheckedSlotValue() ? 'Confirmer' : 'Réserver';
  }
}

let resizeTimer;
function handleResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderAll(false), 150);
}

async function init() {
  if (PFFStorage.getMyBooking()) {
    window.location.replace('confirmation.html');
    return;
  }

  setLoading(true);
  try {
    await PFFStorage.init();
    if (!PFFStorage.isCloudModeActive()) {
      console.warn('[PFF] Mode local — configurez Firebase dans config.js');
    }
    renderAll();
    setInterval(async () => {
      try {
        await PFFStorage.refresh();
        renderAll(false);
      } catch { /* silencieux */ }
    }, 30000);
  } catch (err) {
    console.error(err);
    showError('Impossible de charger les créneaux. Rechargez la page.');
  } finally {
    setLoading(false);
  }

  reservationForm.addEventListener('submit', handleSubmit);
  reservationForm.addEventListener('input', hideError);
  window.addEventListener('resize', handleResize);
}

document.addEventListener('DOMContentLoaded', init);
