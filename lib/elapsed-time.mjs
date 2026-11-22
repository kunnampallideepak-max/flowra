// Round once, so 59.9 seconds carries into the next minute.
export function formatElapsedTime(minutes) {
  const totalSeconds = Math.round(minutes * 60);
  const wholeMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!seconds) return wholeMinutes + ' min';
  if (!wholeMinutes) return seconds + ' sec';
  return wholeMinutes + ' min ' + seconds + ' sec';
}
