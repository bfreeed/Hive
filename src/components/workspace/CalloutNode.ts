import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import React from 'react';

function CalloutView({ node, updateAttributes, editor }: any) {
  const icons: Record<string, string> = { info: '\u{1F4A1}', warning: '\u26A0\uFE0F', tip: '\u2705', note: '\u{1F4DD}' };
  const colors: Record<string, string> = {
    info: 'border-blue-500/40 bg-blue-500/[0.07]',
    warning: 'border-amber-500/40 bg-amber-500/[0.07]',
    tip: 'border-emerald-500/40 bg-emerald-500/[0.07]',
    note: 'border-white/20 bg-white/[0.04]',
  };
  const t = node.attrs.type ?? 'info';
  return React.createElement(NodeViewWrapper, null,
    React.createElement('div', { className: `flex gap-3 rounded-lg border-l-4 px-4 py-3 my-2 ${colors[t] ?? colors.info}` },
      React.createElement('span', { className: 'text-lg flex-shrink-0 mt-0.5' }, icons[t]),
      React.createElement(NodeViewContent, { className: 'flex-1 min-w-0' }),
      editor.isEditable && React.createElement('div', { className: 'flex gap-1 flex-shrink-0' },
        Object.keys(icons).map(k =>
          React.createElement('button', {
            key: k,
            onClick: () => updateAttributes({ type: k }),
            className: `text-xs px-1.5 py-0.5 rounded transition-colors ${t === k ? 'bg-white/20 text-white' : 'text-white/30 hover:text-white/60'}`,
          }, icons[k])
        )
      )
    )
  );
}

export const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { type: { default: 'info' } };
  },
  parseHTML() { return [{ tag: 'div[data-callout]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'callout-node' }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});
