'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, SkipForward } from 'lucide-react';
import type { TourStep } from '@/lib/onboarding/tour-steps';

interface TourOverlayProps {
  steps: TourStep[];
  app: 'main';
  moduleSlug: string;
  initialStep?: number;
  onComplete: () => void;
  onExit: () => void;
  onStepChange?: (step: number) => void;
}

export default function TourOverlay({
  steps,
  app,
  moduleSlug,
  initialStep = 0,
  onComplete,
  onExit,
  onStepChange,
}: TourOverlayProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  // Track step event
  const trackStep = useCallback(
    (eventType: string, stepIndex: number) => {
      fetch('/api/onboarding/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app,
          module_slug: moduleSlug,
          event_type: eventType,
          step_index: stepIndex,
          step_title: steps[stepIndex]?.title,
        }),
      }).catch(() => {});
    },
    [app, moduleSlug, steps],
  );

  // Persist step to DB
  const persistStep = useCallback(
    (step: number, status: string) => {
      fetch(`/api/onboarding/tours/${moduleSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app, current_step: step, status, skipTimestamp: true }),
      }).catch(() => {});
    },
    [app, moduleSlug],
  );

  // Track tour start
  useEffect(() => {
    if (initialStep === 0) {
      trackStep('tour_started', 0);
      persistStep(0, 'in_progress');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Highlight target element
  useEffect(() => {
    if (!step?.target) return;
    const el = document.querySelector(step.target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('tour-highlight');
      return () => el.classList.remove('tour-highlight');
    }
  }, [step]);

  const handleNext = () => {
    trackStep('step_completed', currentStep);
    if (isLastStep) {
      persistStep(currentStep, 'completed');
      trackStep('tour_completed', currentStep);
      onComplete();
    } else {
      const next = currentStep + 1;
      setCurrentStep(next);
      persistStep(next, 'in_progress');
      onStepChange?.(next);
    }
  };

  const handleSkipStep = () => {
    trackStep('step_skipped', currentStep);
    if (isLastStep) {
      persistStep(currentStep, 'completed');
      onComplete();
    } else {
      const next = currentStep + 1;
      setCurrentStep(next);
      persistStep(next, 'in_progress');
      onStepChange?.(next);
    }
  };

  const handleExit = () => {
    trackStep('tour_exited', currentStep);
    persistStep(currentStep, 'skipped');
    onExit();
  };

  if (!step) return null;

  // Determine placement offset
  const _placementClasses: Record<string, string> = {
    top: 'bottom-full mb-3',
    bottom: 'top-full mt-3',
    left: 'right-full mr-3',
    right: 'left-full ml-3',
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={handleExit} aria-hidden="true" />

      {/* Tour card — fixed at bottom on mobile, centered on desktop */}
      <div
        className="fixed bottom-4 left-4 right-4 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[420px] z-[9999] bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-5"
        role="dialog"
        aria-modal="true"
        aria-label={`Tour step ${currentStep + 1} of ${steps.length}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium text-neutral-500">
            Step {currentStep + 1} of {steps.length}
          </span>
          <button
            onClick={handleExit}
            className="flex items-center justify-center min-h-11 min-w-11 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition"
            aria-label="Exit tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <h3 className="text-base font-semibold text-neutral-100 mb-2">
          {step.title}
        </h3>
        <p className="text-sm text-neutral-400 leading-relaxed mb-5">
          {step.description}
        </p>

        {/* Progress bar */}
        <div className="w-full h-1 bg-neutral-800 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-sky-500 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSkipStep}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition min-h-11 px-2"
          >
            <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
            Skip
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-semibold transition min-h-11"
          >
            {isLastStep ? 'Finish' : 'Next'}
            {!isLastStep && <ChevronRight className="w-4 h-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Global highlight styles */}
      <style jsx global>{`
        .tour-highlight {
          position: relative;
          z-index: 9999;
          box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.4), 0 0 20px rgba(14, 165, 233, 0.2);
          border-radius: 0.75rem;
          transition: box-shadow 0.3s ease;
        }
      `}</style>
    </>
  );
}
