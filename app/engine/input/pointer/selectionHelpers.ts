export function toggleThingSelection(selectedIds: string[], id: string) {
  return selectedIds.includes(id)
    ? selectedIds.filter((current) => current !== id)
    : [...selectedIds, id];
}

export function nextSelectedIdsForClick(
  currentIds: string[],
  hitId: string,
  addToExisting: boolean
) {
  if (addToExisting) {
    return toggleThingSelection(currentIds, hitId);
  }
  if (currentIds.includes(hitId)) {
    return currentIds;
  }
  return [hitId];
}
