import { CheckBoxDraft } from "./types";

const STORAGE_KEY = "trustally:check-box-drafts";

type StoredDrafts = Record<string, CheckBoxDraft>;

function readDrafts() {
  if (typeof window === "undefined") {
    return {} as StoredDrafts;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredDrafts) : {};
  } catch {
    return {} as StoredDrafts;
  }
}

function writeDrafts(nextDrafts: StoredDrafts) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDrafts));
}

export function loadCheckBoxDraft(cycleId: string) {
  return readDrafts()[cycleId] ?? null;
}

export function saveCheckBoxDraft(draft: CheckBoxDraft) {
  const drafts = readDrafts();
  drafts[draft.cycleId] = draft;
  writeDrafts(drafts);
}

export function clearCheckBoxDraft(cycleId: string) {
  const drafts = readDrafts();
  delete drafts[cycleId];
  writeDrafts(drafts);
}
