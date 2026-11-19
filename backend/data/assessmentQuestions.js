/**
 * JobNest work-style assessment (version 1).
 *
 * 20 statements, 4 for each of 5 work-style dimensions. Answers use a 1-5 scale
 * (1 = strongly disagree, 5 = strongly agree). "reverse: true" statements are
 * scored as 6 - answer. This is an indicative self-report questionnaire written
 * for this project; it is NOT a scientifically validated psychometric test.
 */

const SCALE = [
  { value: 1, label: 'Strongly disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly agree' },
];

const DIMENSIONS = {
  collaborative: {
    label: 'Collaboration',
    high: 'You are energised by teamwork, shared goals and open discussion.',
    low: 'You prefer to concentrate on your own work and contribute through individual output.',
    environments: 'Cross-functional teams, pair work, agile squads and client-facing roles.',
  },
  structured: {
    label: 'Structure',
    high: 'You value clear processes, planning and well-defined responsibilities.',
    low: 'You are comfortable with ambiguity and changing priorities.',
    environments: 'Established organisations, regulated industries, operations and quality roles.',
  },
  innovative: {
    label: 'Innovation',
    high: 'You enjoy experimenting, trying new tools and improving how things are done.',
    low: 'You prefer reliable, proven methods over untested ideas.',
    environments: 'Product teams, research and development, start-ups and digital transformation.',
  },
  fast_paced: {
    label: 'Pace',
    high: 'You stay productive under deadlines and handle many tasks at once.',
    low: 'You do your best work at a steady, predictable pace.',
    environments: 'Start-ups, delivery and operations teams, field service and incident response.',
  },
  independent: {
    label: 'Autonomy',
    high: 'You like ownership, making your own decisions and managing your own time.',
    low: 'You appreciate regular guidance and frequent check-ins.',
    environments: 'Remote work, consulting, specialist and senior individual-contributor roles.',
  },
};

const QUESTIONS = [
  { id: 'c1', dimension: 'collaborative', text: 'I do my best work when I can discuss ideas with teammates.' },
  { id: 's1', dimension: 'structured', text: 'I prefer having clear processes and written guidelines for my work.' },
  { id: 'i1', dimension: 'innovative', text: 'I enjoy experimenting with new tools or methods, even if they might not work.' },
  { id: 'f1', dimension: 'fast_paced', text: 'I stay productive when handling several urgent tasks at once.' },
  { id: 'd1', dimension: 'independent', text: 'I am comfortable making decisions without waiting for approval.' },

  { id: 'c2', dimension: 'collaborative', text: 'I enjoy sharing credit for a successful project with a group.' },
  { id: 's2', dimension: 'structured', text: 'I plan my tasks in detail before I start working on them.' },
  { id: 'i2', dimension: 'innovative', text: 'I often suggest new ways of doing routine tasks.' },
  { id: 'f2', dimension: 'fast_paced', text: 'Tight deadlines motivate me rather than stress me.' },
  { id: 'd2', dimension: 'independent', text: 'I like to manage my own schedule and working methods.' },

  { id: 'c3', dimension: 'collaborative', reverse: true, text: 'I would rather solve a difficult problem alone than ask colleagues for input.' },
  { id: 's3', dimension: 'structured', reverse: true, text: 'I am comfortable when priorities change without much notice.' },
  { id: 'i3', dimension: 'innovative', reverse: true, text: 'I prefer proven methods over trying untested ideas.' },
  { id: 'f3', dimension: 'fast_paced', reverse: true, text: 'I prefer a steady pace of work with few sudden demands.' },
  { id: 'd3', dimension: 'independent', reverse: true, text: 'I prefer frequent guidance and check-ins from my manager.' },

  { id: 'c4', dimension: 'collaborative', text: 'I actively offer help to colleagues even when it is not part of my role.' },
  { id: 's4', dimension: 'structured', text: 'I value predictable schedules and well-defined responsibilities.' },
  { id: 'i4', dimension: 'innovative', text: 'I keep up with emerging trends and technologies in my field.' },
  { id: 'f4', dimension: 'fast_paced', text: 'I adapt quickly when I have to switch between different tasks.' },
  { id: 'd4', dimension: 'independent', text: 'I take ownership of tasks from start to finish with minimal supervision.' },
];

module.exports = { SCALE, DIMENSIONS, QUESTIONS, VERSION: 1 };
