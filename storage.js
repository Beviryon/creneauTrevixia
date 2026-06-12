/**
 * PFF — Couche d'accès aux données
 *
 * Mode cloud (Firebase Firestore) : réservations partagées entre tous les candidats.
 * Mode local (fallback)           : localStorage si config.js absent ou incomplet.
 *
 * Configurez config.js (voir config.example.js) avant déploiement.
 */
'use strict';

const PFFStorage = (function () {
  const STORAGE_KEY = 'pff_reservations';
  const MY_BOOKING_KEY = 'pff_my_booking';
  const COLLECTION = 'reservations';
  const SETTINGS_COLLECTION = 'meta';
  const SETTINGS_DOC_ID = 'slots_config';
  const LOCAL_SLOTS_KEY = 'pff_slots_config';

  const DEFAULT_SLOTS = [
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
    // 'Jeudi 4 Juin – 19h30 à 20h05',
    // 'Jeudi 4 Juin – 20h10 à 20h45',
    // 'Jeudi 4 Juin – 20h50 à 21h25',
    // 'Vendredi 5 Juin – 19h30 à 20h05',
    // 'Vendredi 5 Juin – 20h10 à 20h45',
    // 'Vendredi 5 Juin – 20h50 à 21h25',
    // 'Samedi 6 Juin – 19h30 à 20h05',
    // 'Samedi 6 Juin – 20h10 à 20h45',
    // 'Samedi 6 Juin – 20h50 à 21h25',
    // 'Dimanche 7 Juin – 19h30 à 20h05',
    // 'Dimanche 7 Juin – 20h10 à 20h45',
    // 'Dimanche 7 Juin – 20h50 à 21h25',
  ];

  let _slots = DEFAULT_SLOTS.slice();

  let _cache = [];
  let _initialized = false;
  let _db = null;

  function getConfig() {
    return window.PFF_CONFIG || {};
  }

  function isCloudMode() {
    const cfg = getConfig().firebase;
    return Boolean(
      cfg &&
      cfg.apiKey &&
      cfg.projectId &&
      !String(cfg.apiKey).includes('VOTRE') &&
      !String(cfg.projectId).includes('votre-projet')
    );
  }

  /** ID document Firestore stable pour un créneau */
  function slotToDocId(slot) {
    return btoa(unescape(encodeURIComponent(slot)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function mapDoc(doc) {
    const d = doc.data();
    const created = d.createdAt;
    return {
      id: doc.id,
      slot: d.slot,
      fullName: d.fullName,
      email: d.email,
      brand: d.brand,
      date: created?.toDate ? created.toDate().toISOString() : (created || new Date().toISOString()),
    };
  }

  function getDb() {
    if (_db) return _db;
    const cfg = getConfig().firebase;
    if (!firebase.apps.length) {
      firebase.initializeApp(cfg);
    }
    _db = firebase.firestore();
    return _db;
  }

  function isPermissionDenied(err) {
    return err && (err.code === 'permission-denied' || String(err.message || '').includes('Missing or insufficient permissions'));
  }

  function normalizeSlots(slots) {
    if (!Array.isArray(slots)) return [];
    const normalized = slots
      .map((slot) => String(slot || '').trim())
      .filter(Boolean);
    return Array.from(new Set(normalized));
  }

  function getLocalSlots() {
    try {
      const raw = localStorage.getItem(LOCAL_SLOTS_KEY);
      if (!raw) return DEFAULT_SLOTS.slice();
      const parsed = JSON.parse(raw);
      const slots = normalizeSlots(parsed);
      return slots.length > 0 ? slots : DEFAULT_SLOTS.slice();
    } catch {
      return DEFAULT_SLOTS.slice();
    }
  }

  function saveLocalSlots(slots) {
    localStorage.setItem(LOCAL_SLOTS_KEY, JSON.stringify(slots));
  }

  /* --- localStorage (fallback) --- */

  function getLocalReservations() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveLocalReservation(reservation) {
    const list = getLocalReservations();
    if (list.some((r) => r.slot === reservation.slot)) {
      return { ok: false, error: 'SLOT_TAKEN' };
    }
    if (list.some((r) => r.email.toLowerCase() === reservation.email.toLowerCase())) {
      return { ok: false, error: 'EMAIL_TAKEN' };
    }
    list.push({ ...reservation, date: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    _cache = list;
    return { ok: true };
  }

  /* --- Firebase Firestore --- */

  async function fetchCloudReservations() {
    const db = getDb();
    const snap = await db.collection(COLLECTION).orderBy('createdAt', 'asc').get();
    return snap.docs.map(mapDoc);
  }

  async function saveCloudReservation(reservation) {
    const db = getDb();
    const email = reservation.email.trim().toLowerCase();
    const slotRef = db.collection(COLLECTION).doc(slotToDocId(reservation.slot));

    const emailSnap = await db.collection(COLLECTION).where('email', '==', email).limit(1).get();
    if (!emailSnap.empty) {
      return { ok: false, error: 'EMAIL_TAKEN' };
    }

    try {
      await db.runTransaction(async (tx) => {
        const slotDoc = await tx.get(slotRef);
        if (slotDoc.exists) {
          throw new Error('SLOT_TAKEN');
        }
        tx.set(slotRef, {
          slot: reservation.slot,
          fullName: reservation.fullName,
          email,
          brand: reservation.brand,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
      return { ok: true };
    } catch (err) {
      if (err.message === 'SLOT_TAKEN') {
        return { ok: false, error: 'SLOT_TAKEN' };
      }
      console.error('[PFF] Firebase save', err);
      return { ok: false, error: 'NETWORK' };
    }
  }

  async function deleteCloudReservation(slot, email) {
    const db = getDb();
    const ref = db.collection(COLLECTION).doc(slotToDocId(slot));
    const doc = await ref.get();
    if (!doc.exists) return false;
    if (doc.data().email !== email.trim().toLowerCase()) return false;
    await ref.delete();
    return true;
  }

  async function clearCloudReservations() {
    const db = getDb();
    const snap = await db.collection(COLLECTION).get();
    if (snap.empty) return;

    const batchSize = 400;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = db.batch();
      docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  async function deleteCloudReservationsBySlots(slots) {
    const db = getDb();
    const target = new Set(slots);
    if (target.size === 0) return 0;

    const snap = await db.collection(COLLECTION).get();
    const docsToDelete = snap.docs.filter((doc) => target.has(doc.data().slot));
    if (docsToDelete.length === 0) return 0;

    const batchSize = 400;
    for (let i = 0; i < docsToDelete.length; i += batchSize) {
      const batch = db.batch();
      docsToDelete.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    return docsToDelete.length;
  }

  async function fetchCloudSlots() {
    try {
      const db = getDb();
      const doc = await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID).get();
      if (!doc.exists) return DEFAULT_SLOTS.slice();
      const data = doc.data() || {};
      const slots = normalizeSlots(data.slots);
      return slots.length > 0 ? slots : DEFAULT_SLOTS.slice();
    } catch (err) {
      if (isPermissionDenied(err)) {
        console.warn('[PFF] Permissions Firestore insuffisantes pour lire meta/slots_config, fallback sur les créneaux par défaut.');
        return DEFAULT_SLOTS.slice();
      }
      throw err;
    }
  }

  async function saveCloudSlots(slots) {
    const db = getDb();
    await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID).set({
      slots,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  /* --- API publique --- */

  async function init() {
    if (_initialized) return;
    if (isCloudMode()) {
      _slots = await fetchCloudSlots();
      _cache = await fetchCloudReservations();
      console.info('[PFF] Mode cloud Firebase actif');
    } else {
      _slots = getLocalSlots();
      _cache = getLocalReservations();
      console.warn('[PFF] Mode localStorage — configurez Firebase dans config.js');
    }
    _initialized = true;
  }

  async function refresh() {
    if (isCloudMode()) {
      _cache = await fetchCloudReservations();
    } else {
      _cache = getLocalReservations();
    }
    return _cache;
  }

  function getReservations() {
    return _cache;
  }

  function getSlots() {
    return _slots.slice();
  }

  async function saveReservation(reservation) {
    if (!_slots.includes(reservation.slot)) {
      return { ok: false, error: 'SLOT_INVALID' };
    }
    let result;
    if (isCloudMode()) {
      result = await saveCloudReservation(reservation);
      if (result.ok) await refresh();
    } else {
      result = saveLocalReservation(reservation);
    }
    return result;
  }

  function getMyBooking() {
    try {
      const raw = localStorage.getItem(MY_BOOKING_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setMyBooking(booking) {
    try {
      localStorage.setItem(MY_BOOKING_KEY, JSON.stringify({
        ...booking,
        email: booking.email.trim().toLowerCase(),
        bookedAt: new Date().toISOString(),
      }));
      return true;
    } catch {
      return false;
    }
  }

  function getReservedSlots() {
    return new Set(_cache.map((r) => r.slot));
  }

  function getReservationBySlot(slot) {
    return _cache.find((r) => r.slot === slot) || null;
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
    _slots.forEach((slot, index) => {
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

  async function setSlots(nextSlots) {
    const normalized = normalizeSlots(nextSlots);
    if (normalized.length === 0) {
      return { ok: false, error: 'EMPTY_SLOTS' };
    }

    try {
      if (isCloudMode()) {
        await saveCloudSlots(normalized);
      } else {
        saveLocalSlots(normalized);
      }
    } catch (err) {
      if (isPermissionDenied(err)) {
        return { ok: false, error: 'PERMISSION' };
      }
      console.error('[PFF] Save slots', err);
      return { ok: false, error: 'NETWORK' };
    }

    _slots = normalized;
    return { ok: true };
  }

  async function deleteReservationsBySlots(slots) {
    const normalized = normalizeSlots(slots);
    if (normalized.length === 0) return { ok: true, deleted: 0 };

    try {
      let deleted = 0;
      if (isCloudMode()) {
        deleted = await deleteCloudReservationsBySlots(normalized);
        await refresh();
      } else {
        const target = new Set(normalized);
        const current = getLocalReservations();
        const kept = current.filter((r) => !target.has(r.slot));
        deleted = current.length - kept.length;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
        _cache = kept;
      }
      return { ok: true, deleted };
    } catch (err) {
      if (isPermissionDenied(err)) {
        return { ok: false, error: 'PERMISSION' };
      }
      console.error('[PFF] Delete reservations by slots', err);
      return { ok: false, error: 'NETWORK' };
    }
  }

  async function clearAll() {
    if (isCloudMode()) {
      await clearCloudReservations();
      await refresh();
    } else {
      localStorage.removeItem(STORAGE_KEY);
      _cache = [];
    }
    localStorage.removeItem(MY_BOOKING_KEY);
  }

  async function cancelMyBooking() {
    const myBooking = getMyBooking();
    if (!myBooking) return false;

    let ok;
    if (isCloudMode()) {
      ok = await deleteCloudReservation(myBooking.slot, myBooking.email);
      if (ok) await refresh();
    } else {
      const email = myBooking.email.toLowerCase();
      _cache = getLocalReservations().filter(
        (r) => !(r.slot === myBooking.slot && r.email.toLowerCase() === email)
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
      ok = true;
    }

    if (ok) localStorage.removeItem(MY_BOOKING_KEY);
    return ok;
  }

  function isCloudModeActive() {
    return isCloudMode();
  }

  return {
    get SLOTS() {
      return _slots.slice();
    },
    get TOTAL_SLOTS() {
      return _slots.length;
    },
    init,
    refresh,
    getReservations,
    getSlots,
    setSlots,
    deleteReservationsBySlots,
    saveReservation,
    getMyBooking,
    setMyBooking,
    getReservedSlots,
    getReservationBySlot,
    parseSlot,
    groupSlotsByDay,
    clearAll,
    cancelMyBooking,
    isCloudModeActive,
  };
})();
