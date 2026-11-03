/** מזהה סרטון מקישור YouTube (watch, youtu.be, shorts, embed). */
export function youTubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}
