import React, { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../store';
import TaskDetail from './TaskDetail';
import type { Task } from '../types';

export interface InlineCaptureHandle {
  open: () => void;
}

export interface InlineCaptureProps {
  initialTitle?: string;
  initialProjectId?: string;
  initialAssigneeId?: string;
  onCreated?: () => void;
  onCancel?: () => void;
  /** Legacy prop, ignored — kept for backwards compat with existing callers */
  onOpenDetail?: (taskId: string) => void;
  /** When false, the collapsed button is hidden and TaskDetail auto-opens. Default: true */
  showCollapsedButton?: boolean;
}

/**
 * Trigger button for creating a new task. When clicked, opens the full TaskDetail
 * panel in draft mode — no task is saved until the user clicks "Add task".
 */
const InlineCapture = forwardRef<InlineCaptureHandle, InlineCaptureProps>(function InlineCapture(props, ref) {
  const { initialTitle, initialProjectId, initialAssigneeId, onCreated, onCancel, showCollapsedButton = true } = props;
  const { currentUser } = useStore();
  const [show, setShow] = useState(!showCollapsedButton);

  useImperativeHandle(ref, () => ({
    open: () => setShow(true),
  }));

  // Auto-open if showCollapsedButton is false
  useEffect(() => {
    if (!showCollapsedButton) setShow(true);
  }, [showCollapsedButton]);

  const handleClose = () => {
    setShow(false);
    onCancel?.();
  };

  const draftInitial: Partial<Task> = {
    title: initialTitle ?? '',
    projectIds: initialProjectId ? [initialProjectId] : [],
    assigneeIds: [initialAssigneeId ?? currentUser.id],
  };

  return (
    <div className="relative w-full">
      {!show && showCollapsedButton && (
        <button
          onClick={() => setShow(true)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/40 hover:border-white/55 text-white/40 hover:text-white/60 text-sm transition-colors"
        >
          <Plus size={14} /> New Task…
          <span className="ml-auto text-xs font-mono bg-white/[0.06] px-1.5 py-0.5 rounded">N</span>
        </button>
      )}
      {show && (
        <div className="absolute left-0 top-0 z-20 w-[min(640px,calc(100vw-3rem))]">
          <TaskDetail
            inline
            draftInitial={draftInitial}
            onClose={() => {
              handleClose();
              onCreated?.();
            }}
          />
        </div>
      )}
    </div>
  );
});

export default InlineCapture;
