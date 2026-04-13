function toSingleSpaced(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

export function normalizePlaceName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return toSingleSpaced(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function tokenizePlaceName(value) {
  const normalized = normalizePlaceName(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}
