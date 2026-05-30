/**
 * PFF — Couche d'accès aux données (localStorage)
 *
 * NOTE V1 : localStorage est local à chaque navigateur/appareil.
 * Ce n'est PAS un verrouillage partagé entre utilisateurs ou machines.
 * Ces fonctions pourront être remplacées par des appels réseau sans toucher au reste.
 */
'use strict';

const PFFStorage = (function () {
  const STORAGE_KEY = 'pff_reservations';
  const MY_BOOKING_KEY = 'pff_my_booking';

  const SLOTS = [
    'Dimanche 31 Mai – 19h30 à 20h05',
    'Dimanche 31 Mai – 20h10 à 20h45',
    'Dimanche 31 Mai – 20h50 à 21h25',
    'Lundi 1er Juin – 19h30 à 20h05',
    'Lundi 1er Juin – 20h10 à 20h45',
    'Lundi 1er Juin – 20h50 à 21h25',
    'Mardi 2 Juin – 19h30 à 20h05',
    'Mardi 2 Juin – 20h10 à 20h45',
    'Mardi 2 Juin – 20h50 à 21h25',
    'Mercredi 3 Juin – 19h30 à 20h05',
    'Mercredi 3 Juin – 20h10 à 20h45',
    'Mercredi 3 Juin – 20h50 à 21h25',
    'Jeudi 4 Juin – 19h30 à 20h05',
    'Jeudi 4 Juin – 20h10 à 20h45',
    'Jeudi 4 Juin – 20h50 à 21h25',
    'Vendredi 5 Juin – 19h30 à 20h05',
    'Vendredi 5 Juin – 20h10 à 20h45',
    'Vendredi 5 Juin – 20h50 à 21h25',
    'Samedi 6 Juin – 19h30 à 20h05',
    'Samedi 6 Juin – 20h10 à 20h45',
    'Samedi 6 Juin – 20h50 à 21h25',
    'Dimanche 7 Juin – 19h30 à 20h05',
    'Dimanche 7 Juin – 20h10 à 20h45',
    'Dimanche 7 Juin – 20h50 à 21h25',
  ];

  const TOTAL_SLOTS = SLOTS.length;

  function getReservations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('[PFF] Erreur lecture réservations :', err);
      return [];
    }
  }

  function saveReservation(reservation) {
    try {
      const reservations = getReservations();
      reservations.push({
        ...reservation,
        date: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
      return true;
    } catch (err) {
      console.error('[PFF] Erreur sauvegarde réservation :', err);
      return false;
    }
  }

  /** Réservation de l'utilisateur courant (verrou local navigateur) */
  function getMyBooking() {
    try {
      const raw = localStorage.getItem(MY_BOOKING_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.error('[PFF] Erreur lecture booking personnel :', err);
      return null;
    }
  }

  function setMyBooking(booking) {
    try {
      localStorage.setItem(MY_BOOKING_KEY, JSON.stringify({
        ...booking,
        bookedAt: new Date().toISOString(),
      }));
      return true;
    } catch (err) {
      console.error('[PFF] Erreur sauvegarde booking personnel :', err);
      return false;
    }
  }

  function getReservedSlots() {
    return new Set(getReservations().map((r) => r.slot));
  }

  function getReservationBySlot(slot) {
    return getReservations().find((r) => r.slot === slot) || null;
  }

  function parseSlot(slotString) {
    const parts = slotString.split(' – ');
    const day = parts[0] || '';
    const timePart = parts[1] || '';
    const timeSplit = timePart.split(' à ');
    return {
      day,
      start: timeSplit[0] || '',
      end: timeSplit[1] || '',
      time: timePart,
      full: slotString,
    };
  }

  function groupSlotsByDay() {
    const groups = [];
    const map = new Map();

    SLOTS.forEach((slot, index) => {
      const { day } = parseSlot(slot);
      if (!map.has(day)) {
        const group = { day, slots: [] };
        map.set(day, group);
        groups.push(group);
      }
      map.get(day).slots.push({ slot, index, parsed: parseSlot(slot) });
    });

    return groups;
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MY_BOOKING_KEY);
  }

  /* ------------------------------------------------------------------------
     Accès admin (V1 — sessionStorage + code PIN)
     NOTE : protection côté client uniquement. À remplacer par une auth serveur
     en production. Changez ADMIN_PIN avant mise en ligne.
     ------------------------------------------------------------------------ */
  const ADMIN_PIN = 'PFF@Trevixia26';
  const ADMIN_SESSION_KEY = 'pff_admin_session';

  function isAdminAuthenticated() {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  }

  function setAdminAuthenticated() {
    try {
      sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
      return true;
    } catch {
      return false;
    }
  }

  function clearAdminSession() {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  function verifyAdminPin(pin) {
    return pin === ADMIN_PIN;
  }

  /** Annule la réservation de l'utilisateur courant et libère le créneau */
  function cancelMyBooking() {
    try {
      const myBooking = getMyBooking();
      if (!myBooking) return false;

      const email = myBooking.email.toLowerCase();
      const reservations = getReservations().filter(
        (r) => !(r.slot === myBooking.slot && r.email.toLowerCase() === email)
      );

      localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
      localStorage.removeItem(MY_BOOKING_KEY);
      return true;
    } catch (err) {
      console.error('[PFF] Erreur annulation réservation :', err);
      return false;
    }
  }

  return {
    STORAGE_KEY,
    MY_BOOKING_KEY,
    SLOTS,
    TOTAL_SLOTS,
    getReservations,
    saveReservation,
    getMyBooking,
    setMyBooking,
    getReservedSlots,
    getReservationBySlot,
    parseSlot,
    groupSlotsByDay,
    clearAll,
    cancelMyBooking,
    isAdminAuthenticated,
    setAdminAuthenticated,
    clearAdminSession,
    verifyAdminPin,
  };
})();
