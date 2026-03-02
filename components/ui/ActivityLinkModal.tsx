'use client';

import Modal from '@/components/ui/Modal';
import ActivityLinker from '@/components/ui/ActivityLinker';
import LifeCategoryTagger from '@/components/ui/LifeCategoryTagger';

interface ActivityLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'task' | 'trip' | 'route' | 'transaction' | 'recipe' | 'fuel_log' | 'maintenance' | 'invoice' | 'workout' | 'equipment' | 'focus_session';
  entityId: string;
  title?: string;
}

export default function ActivityLinkModal({
  isOpen,
  onClose,
  entityType,
  entityId,
  title = 'Linked Activities',
}: ActivityLinkModalProps) {
  if (!entityId) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="p-5 space-y-4">
        <ActivityLinker entityType={entityType} entityId={entityId} />
        <div className="border-t border-gray-200 pt-4">
          <LifeCategoryTagger entityType={entityType} entityId={entityId} />
        </div>
      </div>
    </Modal>
  );
}
