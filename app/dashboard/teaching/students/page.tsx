'use client';

// app/dashboard/teaching/students/page.tsx
// Teacher view of enrolled students across all courses.

import { useEffect, useState } from 'react';
import { Users, Mail } from 'lucide-react';

interface Student {
  id: string;
  user_id: string;
  course_id: string;
  course_title: string;
  enrolled_at: string;
  email: string | null;
  profiles: { username: string | null; display_name: string | null } | null;
}

export default function TeachingStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/teacher/students')
      .then((r) => r.json())
      .then((data) => {
        setStudents(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = students.filter((s) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      s.profiles?.username?.toLowerCase().includes(q) ||
      s.profiles?.display_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.course_title.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Students</h1>
          <p className="text-gray-400 text-sm mt-1">{students.length} active enrollment{students.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search by name, email, or course…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full mb-6 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-fuchsia-500"
      />

      {filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-16 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500">
            {students.length === 0 ? 'No students enrolled yet.' : 'No results match your search.'}
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Student</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Course</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Enrolled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-800/40 transition">
                  <td className="px-5 py-3">
                    <p className="text-white font-medium">
                      {s.profiles?.display_name ?? s.profiles?.username ?? 'Unknown'}
                      {s.profiles?.username && (
                        <span className="text-gray-500 font-normal ml-1.5">@{s.profiles.username}</span>
                      )}
                    </p>
                    {s.email && (
                      <a
                        href={`mailto:${s.email}`}
                        className="flex items-center gap-1 text-gray-500 hover:text-fuchsia-400 text-xs mt-0.5 transition"
                      >
                        <Mail className="w-3 h-3" />
                        {s.email}
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-300">{s.course_title}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {new Date(s.enrolled_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
