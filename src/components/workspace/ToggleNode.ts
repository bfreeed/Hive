import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import React from 'react';

function ToggleView({ node, updateAttributes }: any) {
  const open = node.attrs.open ?? true;
  return React.createElement(NodeViewWrapper, null,
    React.createElement('div', { className: 'my-1' },
      React.createElement('div', {
        className: 'flex items-center gap-2 cursor-pointer select-none',
        onClick: () => updateAttributes({ open: !open }),
      },
        React.createElement('span', { className: `text-white/30 transition-transform text-xs ${open ? 'rotate-90' : ''}` }, '\u25B6'),
        React.createElement('span', { className: 'text-sm text-white/60' }, 'Toggle section')
      ),
      open && React.createElement('div', { className: 'pl-5 border-l border-white/10 ml-1.5 mt-1' },
        React.createElement(NodeViewContent, null)
      )
    )
  );
}

export const ToggleNode = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { open: { default: true } };
  },
  parseHTML() { return [{ tag: 'details' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ToggleView);
  },
});
