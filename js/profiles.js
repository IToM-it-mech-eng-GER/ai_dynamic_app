import { normalizeProduct } from "./calculator.js";

export const PROFILE_STORAGE_KEY = "renditeatlas.profile-setups.v1";
const PROFILE_LIMIT = 20;

export function normalizeProfileName(value) {
  return String(value ?? "").trim().slice(0, 48);
}

export function readProfiles(serialized) {
  if (!serialized) return [];
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeProfile)
      .filter(Boolean)
      .slice(0, PROFILE_LIMIT);
  } catch {
    return [];
  }
}

export function serializeProfiles(profiles) {
  return JSON.stringify(profiles.slice(0, PROFILE_LIMIT).map(normalizeProfile).filter(Boolean));
}

export function upsertProfile(profiles, name, setup, metadata = {}) {
  const normalizedName = normalizeProfileName(name);
  if (!normalizedName || !setup?.products?.length) return profiles;

  const existingIndex = profiles.findIndex(
    (profile) => profile.name.toLocaleLowerCase("de-DE") === normalizedName.toLocaleLowerCase("de-DE"),
  );
  const profile = normalizeProfile({
    id: metadata.id || `profile-${Date.now()}-${profiles.length}`,
    name: normalizedName,
    savedAt: metadata.savedAt || new Date().toISOString(),
    setup: cloneSetup(setup),
  });
  if (!profile) return profiles;

  if (existingIndex >= 0) {
    return profiles.map((item, index) => index === existingIndex ? profile : item);
  }
  return [profile, ...profiles].slice(0, PROFILE_LIMIT);
}

export function removeProfile(profiles, profileId) {
  return profiles.filter((profile) => profile.id !== profileId);
}

export function cloneSetup(setup) {
  return JSON.parse(JSON.stringify(setup));
}

function normalizeProfile(profile) {
  const name = normalizeProfileName(profile?.name);
  const products = normalizeProducts(profile?.setup?.products);
  if (!name || products.length === 0) return null;

  const selectedId = products.some((product) => product.id === profile.setup.selectedId)
    ? profile.setup.selectedId
    : products[0].id;
  return {
    id: normalizeId(profile.id),
    name,
    savedAt: normalizeDate(profile.savedAt),
    setup: {
      products,
      selectedId,
    },
  };
}

function normalizeProducts(products) {
  if (!Array.isArray(products)) return [];
  return products.slice(0, 3).map((product, index) => ({
    id: normalizeId(product?.id, `plan-${index + 1}`),
    color: normalizeColor(product?.color),
    ...normalizeProduct(product),
  }));
}

function normalizeId(value, fallback = "profile-unknown") {
  const id = String(value ?? "").trim().slice(0, 80);
  return id || fallback;
}

function normalizeColor(value) {
  const color = String(value ?? "");
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#64748b";
}

function normalizeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}
