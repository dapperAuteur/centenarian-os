// components/focus/QualityRatingModal.tsx
'use client';

import { useState } from 'react';
import { X, Star } from 'lucide-react';

interface QualityRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number) => void;
}

/**
 * Quality Rating Modal
 * Prompts user to rate session quality (1-5) on completion
 * For 6th graders: "How well did this work session go?"
 */
export default function QualityRatingModal({
  isOpen,
  onClose,
  onSubmit,
}: QualityRatingModalProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (rating) {
      onSubmit(rating);
      setRating(null);
      setHoveredRating(null);
    }
  };

  const handleSkip = () => {
    onClose();
    setRating(null);
    setHoveredRating(null);
  };

  const ratingLabels = {
    1: { emoji: '😔', label: 'Poor', description: 'Struggled to focus' },
    2: { emoji: '😕', label: 'Below Average', description: 'Some distractions' },
    3: { emoji: '😐', label: 'Average', description: 'Got work done' },
    4: { emoji: '😊', label: 'Good', description: 'Productive session' },
    5: { emoji: '🤩', label: 'Excellent', description: 'In the zone!' },
  };

  const displayRating = hoveredRating || rating || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-1">How'd It Go?</h2>
              <p className="text-sm text-indigo-100">Rate this session's quality</p>
            </div>
            <button
              onClick={handleSkip}
              className="text-white hover:text-indigo-200 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Star Rating */}
          <div className="flex justify-center gap-3 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(null)}
                className="transform transition hover:scale-110 focus:outline-none"
              >
                <Star
                  className={`w-12 h-12 transition ${
                    star <= displayRating
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-300 hover:text-amber-300'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Rating Label */}
          {displayRating > 0 && (
            <div className="text-center mb-6 animate-fade-in">
              <div className="text-5xl mb-2">
                {ratingLabels[displayRating as keyof typeof ratingLabels].emoji}
              </div>
              <div className="text-xl font-bold text-gray-900 mb-1">
                {ratingLabels[displayRating as keyof typeof ratingLabels].label}
              </div>
              <div className="text-sm text-gray-600">
                {ratingLabels[displayRating as keyof typeof ratingLabels].description}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={!rating}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition ${
                rating
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Submit
            </button>
          </div>

          {/* Helper Text */}
          <p className="text-xs text-gray-500 text-center mt-4">
            Quality ratings help you understand which work patterns produce the best results
          </p>
        </div>
      </div>
    </div>
  );
}
