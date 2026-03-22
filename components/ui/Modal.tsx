// components/ui/Modal.tsx
'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

/**
 * Reusable modal component with keyboard support and focus trap
 * Closes on Esc key and click outside
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const hasInitializedRef = useRef(false);

  // Size classes
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  // Focus trap — prevent Tab from leaving the modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const FOCUSABLE = [
      'a[href]', 'button:not([disabled])', 'input:not([disabled])',
      'select:not([disabled])', 'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Handle body scroll and focus - only on mount/unmount
  useEffect(() => {
    if (isOpen) {
      // Store current focus only on initial open
      if (!hasInitializedRef.current) {
        previousFocusRef.current = document.activeElement as HTMLElement;
        hasInitializedRef.current = true;
      }
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      // Focus modal container ONLY if no input is currently focused
      setTimeout(() => {
        const activeElement = document.activeElement;
        const isInputFocused = 
          activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.tagName === 'SELECT';
        
        if (!isInputFocused && modalRef.current) {
          modalRef.current.focus();
        }
      }, 100);
    } else {
      // Reset when modal closes
      hasInitializedRef.current = false;
      document.body.style.overflow = 'unset';
      
      // Restore focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]); // ✅ Only depends on isOpen

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={`relative w-full ${sizeClasses[size]} bg-white rounded-2xl shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="modal-title" className="text-2xl font-bold text-gray-900">
            {title}
          </h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content — mobile uses dvh to account for bottom nav + safe-area */}
        <div className="overflow-y-auto max-h-[calc(100dvh-12rem)] lg:max-h-[calc(100vh-200px)]">
          {children}
        </div>
      </div>
    </div>
  );
}