import { Heart, MapPin, Phone, ExternalLink } from 'lucide-react';

export default function RiseWellnessCard() {
  return (
    <section
      aria-label="Mental health support resources"
      className="bg-white border-l-4 border-sky-200 rounded-xl p-5 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-2">
        <Heart className="w-4 h-4 text-sky-600 shrink-0" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-sky-700">Mental Health Support</h2>
      </div>
      <p className="text-sm text-gray-700 mb-4 leading-relaxed">
        Rise Wellness of Indiana provides compassionate, personalized, holistic mental health
        care — helping you heal, grow, and thrive in mind, body, and spirit.
      </p>
      <address className="not-italic space-y-2">
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>320 N Meridian St, Indianapolis, IN 46204</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Phone className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
          <a
            href="tel:+13179650299"
            aria-label="Call Rise Wellness of Indiana"
            className="text-sky-600 hover:underline"
          >
            317-965-0299
          </a>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
          <a
            href="https://risewellnessofindiana.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 hover:underline"
          >
            risewellnessofindiana.com
          </a>
        </div>
      </address>
    </section>
  );
}
