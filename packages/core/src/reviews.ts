import type { MediaAsset, ReviewField, ReviewRecord } from '@z-cloud/contracts';
export const reviewSnapshot = (a: MediaAsset) => ({
  title: a.title,
  description: a.description,
  tags: a.tags,
  location: a.location,
  capturedAt: a.capturedAt,
});
export const reviewFingerprint = (a: MediaAsset) => JSON.stringify(reviewSnapshot(a));
export const reviewLabels: Record<ReviewField, string> = {
  title: 'Title',
  description: 'Description',
  tags: 'Tags',
  location: 'Location',
  capturedAt: 'Capture date',
};
export function missingMetadata(a: MediaAsset): ReviewField[] {
  const gaps: ReviewField[] = [];
  if (!a.title.trim() || a.title.trim() === a.filename.replace(/\.[^.]+$/, '')) gaps.push('title');
  if (!a.description.trim()) gaps.push('description');
  if (!a.tags.length) gaps.push('tags');
  if (!a.location.trim()) gaps.push('location');
  gaps.push('capturedAt'); // A stored file timestamp is not proof of the capture date.
  return gaps;
}
export function ruleQuestions(a: MediaAsset): ReviewRecord['questions'] {
  const questions = {
    title: ['What would you call this moment?', 'Use a title you will recognize later.'],
    description: [
      'What happened here, and what would you like to remember?',
      'People, activity, context or a small detail.',
    ],
    tags: ['Which words would help you find this again?', 'Separate tags with commas.'],
    location: ['Where was this captured?', 'Leave unknown details blank and choose Skip for now.'],
    capturedAt: [
      `Is ${a.capturedAt.slice(0, 10)} the actual capture date?`,
      'The stored timestamp may come from the file. Confirm or correct it; do not guess.',
    ],
  };
  return missingMetadata(a).map((field) => ({
    field,
    question: questions[field][0],
    hint: questions[field][1],
  }));
}
