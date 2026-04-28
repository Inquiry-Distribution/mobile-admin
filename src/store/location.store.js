/**
 * Location Store — Live Map state
 *
 * Holds the latest position of every active salesperson.
 * Populated by:
 *   1. REST GET /locations/live  — initial load & stale-data fallback
 *   2. Socket "location:update"  — real-time per-ping updates
 *   3. Socket "user:online"      — salesperson comes online
 *   4. Socket "user:offline"     — salesperson goes offline
 *
 * The store is never wiped on screen unmount so re-visiting
 * LiveMapScreen shows data instantly from cache instead of
 * triggering another SQL query.
 */
import { create } from 'zustand';
import { locationApi } from '@api/location.api';
import { CONFIG } from '@constants/config';

// Consider cached data "stale" after this many ms (default: 30 s)
const STALE_MS = CONFIG.MAP_LIVE_REFRESH_MS ?? 30_000;

// ─── Normalise any incoming shape to the canonical location object ──
function normaliseOne(raw) {
  return {
    salespersonId: raw.salespersonId ?? raw.id,
    name:          raw.salespersonName ?? raw.name ?? raw.salesperson?.name ?? 'Unknown',
    lat:           raw.lat   ?? raw.lastLat  ?? raw.latitude  ?? null,
    lng:           raw.lng   ?? raw.lastLng  ?? raw.longitude ?? null,
    address:       raw.address ?? raw.lastAddress ?? null,
    lastLocatedAt: raw.lastLocatedAt ?? raw.recordedAt ?? raw.updatedAt ?? null,
    isOnline:      raw.isOnline ?? false,
  };
}

const useLocationStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────
  locations:     [],   // normalised location objects
  isLoading:     false,
  lastFetchedAt: null, // timestamp of last successful REST fetch

  // ── Initial / fallback REST fetch ─────────────────────────────
  // Only hits the server if data is missing or older than STALE_MS.
  // Pass force=true to bypass the staleness check (e.g. pull-to-refresh).
  fetchIfStale: async (force = false) => {
    const { lastFetchedAt, isLoading } = get();
    if (isLoading) return;

    const age = lastFetchedAt ? Date.now() - lastFetchedAt : Infinity;
    if (!force && age < STALE_MS) return; // cache is fresh — skip

    set({ isLoading: true });
    try {
      const res  = await locationApi.getLive();
      const data = res.data ?? res ?? [];
      set({
        locations:     data.map(normaliseOne),
        lastFetchedAt: Date.now(),
        isLoading:     false,
      });
    } catch (_) {
      set({ isLoading: false });
    }
  },

  // ── Upsert a single location (from socket events) ─────────────
  upsertLocation: (raw) => {
    const incoming = normaliseOne(raw);
    set((state) => {
      const idx = state.locations.findIndex(
        (l) => l.salespersonId === incoming.salespersonId,
      );
      if (idx === -1) {
        return { locations: [...state.locations, incoming] };
      }
      const next = [...state.locations];
      next[idx]  = { ...next[idx], ...incoming };
      return { locations: next };
    });
  },

  // ── Online / offline toggle (from user:online / user:offline) ──
  setOnlineStatus: (salespersonId, isOnline) => {
    set((state) => ({
      locations: state.locations.map((l) =>
        l.salespersonId === salespersonId ? { ...l, isOnline } : l,
      ),
    }));
  },
}));

export default useLocationStore;
