import { PageTemplate } from '../types';

function h(level: 1 | 2 | 3, text: string) {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}
function p(text = '') {
  return text
    ? { type: 'paragraph', content: [{ type: 'text', text }] }
    : { type: 'paragraph' };
}
function bullet(items: string[]) {
  return {
    type: 'bulletList',
    content: items.map(text => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    })),
  };
}
function todo(items: string[]) {
  return {
    type: 'taskList',
    content: items.map(text => ({
      type: 'taskItem',
      attrs: { checked: false },
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    })),
  };
}
function hr() { return { type: 'horizontalRule' }; }

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    icon: '📋',
    description: 'Agenda, decisions, action items, parking lot.',
    content: {
      type: 'doc',
      content: [
        h(1, '📋 Meeting Notes'),
        p('Date: ___   Attendees: ___'),
        hr(),
        h(2, 'Agenda'),
        bullet(['Topic 1', 'Topic 2', 'Topic 3']),
        h(2, 'Notes'),
        p(''),
        h(2, 'Decisions'),
        bullet(['Decision 1']),
        h(2, 'Action Items'),
        todo(['Action item — Owner']),
        h(2, 'Parking Lot'),
        bullet(['Item to revisit later']),
      ],
    },
  },
  {
    id: 'project-brief',
    name: 'Project Brief',
    icon: '🚀',
    description: 'Goal, background, success criteria, timeline, stakeholders.',
    content: {
      type: 'doc',
      content: [
        h(1, '🚀 Project Brief'),
        p(''),
        h(2, 'Goal'),
        p('One sentence: what does success look like?'),
        h(2, 'Background'),
        p('Why are we doing this? What problem does it solve?'),
        h(2, 'Success Criteria'),
        bullet(['Criterion 1', 'Criterion 2']),
        h(2, 'Out of Scope'),
        bullet(['Not doing this in Phase 1']),
        h(2, 'Timeline'),
        p('Start: ___   Target end: ___'),
        h(2, 'Stakeholders'),
        bullet(['Owner: ___', 'Contributors: ___', 'Informed: ___']),
        h(2, 'Open Questions'),
        todo(['Question to resolve']),
      ],
    },
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    icon: '🔁',
    description: 'Wins, misses, blockers, next week priorities.',
    content: {
      type: 'doc',
      content: [
        h(1, '🔁 Weekly Review'),
        p('Week of: ___'),
        hr(),
        h(2, 'Wins'),
        bullet(['What went well?']),
        h(2, 'Misses'),
        bullet(['What fell short?']),
        h(2, 'Blockers'),
        bullet(['What got in the way?']),
        h(2, 'Next Week — Top 3 Priorities'),
        todo(['Priority 1', 'Priority 2', 'Priority 3']),
        h(2, 'Carry Over'),
        bullet(['Task that didn\'t get done']),
      ],
    },
  },
  {
    id: '1on1-agenda',
    name: '1:1 Agenda',
    icon: '🤝',
    description: 'Recurring topics, updates, asks, career.',
    content: {
      type: 'doc',
      content: [
        h(1, '🤝 1:1 Agenda'),
        p('Date: ___   With: ___'),
        hr(),
        h(2, 'Recurring Topics'),
        todo(['Standing item 1', 'Standing item 2']),
        h(2, 'Updates — Their Side'),
        p(''),
        h(2, 'Updates — My Side'),
        p(''),
        h(2, 'Asks'),
        bullet(['Need a decision on ___', 'Need unblocking on ___']),
        h(2, 'Carry Forward'),
        bullet(['From last time: ___']),
      ],
    },
  },
  {
    id: 'client-summary',
    name: 'Client Summary',
    icon: '📊',
    description: 'Context, what we discussed, next steps, open questions.',
    content: {
      type: 'doc',
      content: [
        h(1, '📊 Client Summary'),
        p('Client: ___   Date: ___   Attendees: ___'),
        hr(),
        h(2, 'Context'),
        p('Who are they, what stage of the relationship are we at?'),
        h(2, 'What We Discussed'),
        bullet(['Topic 1', 'Topic 2']),
        h(2, 'Decisions Made'),
        bullet(['Decision 1']),
        h(2, 'Next Steps'),
        todo(['Action — Owner — Due']),
        h(2, 'Open Questions'),
        bullet(['Question to follow up on']),
      ],
    },
  },
  {
    id: 'sop',
    name: 'SOP',
    icon: '📖',
    description: 'Purpose, who this applies to, steps, edge cases.',
    content: {
      type: 'doc',
      content: [
        h(1, '📖 Standard Operating Procedure'),
        p('Process name: ___   Owner: ___   Last updated: ___'),
        hr(),
        h(2, 'Purpose'),
        p('What does this process accomplish?'),
        h(2, 'Who This Applies To'),
        bullet(['Role or person']),
        h(2, 'When to Use This'),
        p('Trigger: ___'),
        h(2, 'Steps'),
        {
          type: 'orderedList',
          content: ['Step 1', 'Step 2', 'Step 3'].map(text => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
          })),
        },
        h(2, 'Edge Cases'),
        bullet(['If X, then Y']),
        h(2, 'Related Docs'),
        bullet(['Link to related SOP']),
      ],
    },
  },
  {
    id: 'research-notes',
    name: 'Research Notes',
    icon: '🔍',
    description: 'Question, sources, findings, conclusions.',
    content: {
      type: 'doc',
      content: [
        h(1, '🔍 Research Notes'),
        p('Topic: ___   Date: ___'),
        hr(),
        h(2, 'Question'),
        p('What are you trying to figure out?'),
        h(2, 'Sources'),
        bullet(['Source 1 — URL', 'Source 2 — URL']),
        h(2, 'Key Findings'),
        bullet(['Finding 1', 'Finding 2']),
        h(2, 'What I Still Need to Know'),
        todo(['Open question']),
        h(2, 'Conclusion'),
        p(''),
      ],
    },
  },
  {
    id: 'decision-log',
    name: 'Decision Log',
    icon: '⚖️',
    description: 'Decision, context, options considered, why we chose this.',
    content: {
      type: 'doc',
      content: [
        h(1, '⚖️ Decision Log'),
        p('Decision: ___   Date: ___   Made by: ___'),
        hr(),
        h(2, 'Context'),
        p('What situation forced this decision?'),
        h(2, 'Options Considered'),
        bullet(['Option A: ___', 'Option B: ___', 'Option C: ___']),
        h(2, 'Why We Chose This'),
        p(''),
        h(2, 'Trade-offs Accepted'),
        bullet(['We gave up ___', 'We accepted the risk of ___']),
        h(2, 'When to Revisit'),
        p('Review this decision if: ___'),
      ],
    },
  },
  {
    id: 'onboarding',
    name: 'Onboarding Guide',
    icon: '🎓',
    description: 'Overview, day 1, first week, key contacts, resources.',
    content: {
      type: 'doc',
      content: [
        h(1, '🎓 Onboarding Guide'),
        p('Role: ___   Start date: ___   Manager: ___'),
        hr(),
        h(2, 'Overview'),
        p('Welcome! Here\'s what you need to know to get started.'),
        h(2, 'Day 1 Checklist'),
        todo(['Set up accounts', 'Meet the team', 'Read the Project Brief']),
        h(2, 'First Week'),
        bullet(['Goal 1', 'Goal 2', 'Shadow ___']),
        h(2, 'Key Contacts'),
        bullet(['Name — Role — Best way to reach']),
        h(2, 'Essential Resources'),
        bullet(['Notion / Hive workspace', 'Shared Drive', 'Slack channels to join']),
        h(2, 'Open Questions'),
        todo(['Ask ___']),
      ],
    },
  },
  {
    id: 'personal-notes',
    name: 'Personal Notes',
    icon: '📝',
    description: 'Scratch pad for anything.',
    content: {
      type: 'doc',
      content: [
        h(1, '📝 Notes'),
        p(''),
        p(''),
      ],
    },
  },
];
