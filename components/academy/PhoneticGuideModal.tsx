'use client';

import Modal from '@/components/ui/Modal';
import { PHONETIC_GUIDE, PHONETIC_NOTATION_RULES, PHONETIC_TIPS } from '@/lib/academy/phoneticGuide';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function PhoneticGuideModal({ isOpen, onClose }: Props) {
  const categories = [...new Set(PHONETIC_GUIDE.map((e) => e.category))];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Phonetic Spelling Guide" size="lg">
      <div className="space-y-6 text-sm">
        {/* Notation Rules */}
        <div>
          <h3 className="text-white font-semibold mb-2">How to Write Phonetic Spellings</h3>
          <ul className="space-y-1.5 text-gray-400">
            {PHONETIC_NOTATION_RULES.map((rule, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-fuchsia-400 shrink-0">{i + 1}.</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sound Reference Tables */}
        {categories.map((cat) => {
          const entries = PHONETIC_GUIDE.filter((e) => e.category === cat);
          return (
            <div key={cat}>
              <h3 className="text-white font-semibold mb-2">{cat}</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-xs">
                      <th className="px-3 py-2">Sound</th>
                      <th className="px-3 py-2">Example Words</th>
                      <th className="px-3 py-2">Phonetic</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {entries.map((e, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-fuchsia-400 font-mono font-semibold">{e.symbol}</td>
                        <td className="px-3 py-1.5 text-gray-300">{e.example_word}</td>
                        <td className="px-3 py-1.5 text-gray-400 italic">{e.example_phonetic}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Example Words */}
        {PHONETIC_TIPS.map((section) => (
          <div key={section.title}>
            <h3 className="text-white font-semibold mb-2">{section.title}</h3>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs">
                    <th className="px-3 py-2">Word</th>
                    <th className="px-3 py-2">Phonetic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {section.examples.map((ex, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-gray-300">{ex.word}</td>
                      <td className="px-3 py-1.5 text-fuchsia-400 italic font-mono">{ex.phonetic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
