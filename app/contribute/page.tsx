// File: app/contribute/page.tsx
import Link from 'next/link';
import { ArrowLeft, Code, FileText, Bug, Lightbulb, Heart, GitBranch } from 'lucide-react';

export default function ContributePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Home</span>
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-fuchsia-500 to-sky-500 rounded-lg"></div>
            <span className="text-xl font-bold text-gray-900">CentenarianOS</span>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4">
          Contribute to CentenarianOS
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Help build the personal operating system for executing multi-decade goals. All skill levels welcome.
        </p>
        <a 
          href="https://github.com/dapperAuteur/centenarian-os" 
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-8 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold"
        >
          <GitBranch className="w-5 h-5 mr-2" />
          View on GitHub
        </a>
      </section>

      {/* Ways to Contribute */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Ways to Contribute</h2>
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Code */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-fuchsia-500">
            <Code className="w-10 h-10 text-fuchsia-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Write Code</h3>
            <p className="text-gray-600 mb-4">
              Implement features, fix bugs, improve performance, or refactor for better maintainability.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center text-gray-700">
                <span className="w-2 h-2 bg-fuchsia-500 rounded-full mr-2"></span>
                Frontend (Next.js, TypeScript, Tailwind)
              </div>
              <div className="flex items-center text-gray-700">
                <span className="w-2 h-2 bg-fuchsia-500 rounded-full mr-2"></span>
                Backend (Supabase, PostgreSQL)
              </div>
              <div className="flex items-center text-gray-700">
                <span className="w-2 h-2 bg-fuchsia-500 rounded-full mr-2"></span>
                Offline sync logic (IndexedDB)
              </div>
            </div>
          </div>

          {/* Documentation */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-sky-500">
            <FileText className="w-10 h-10 text-sky-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Improve Documentation</h3>
            <p className="text-gray-600 mb-4">
              Write tutorials, improve README, add code comments, or create architecture diagrams.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center text-gray-700">
                <span className="w-2 h-2 bg-sky-500 rounded-full mr-2"></span>
                Setup guides for beginners
              </div>
              <div className="flex items-center text-gray-700">
                <span className="w-2 h-2 bg-sky-500 rounded-full mr-2"></span>
                API documentation
              </div>
              <div className="flex items-center text-gray-700">
                <span className="w-2 h-2 bg-sky-500 rounded-full mr-2"></span>
                Video tutorials or screencasts
              </div>
            </div>
          </div>

          {/* Bug Reports */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-amber-500">
            <Bug className="w-10 h-10 text-amber-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Report Bugs</h3>
            <p className="text-gray-600 mb-4">
              Find and report issues with detailed reproduction steps to help us fix problems faster.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center text-gray-700">
                <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                Include error messages
              </div>
              <div className="flex items-center text-gray-700">
                <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                Provide steps to reproduce
              </div>
              <div className="flex items-center text-gray-700">
                <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                Note your browser/OS version
              </div>
            </div>
          </div>

          {/* Feature Requests */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-lime-500">
            <Lightbulb className="w-10 h-10 text-lime-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Suggest Features</h3>
            <p className="text-gray-600 mb-4">
              Share ideas for new features or improvements to existing functionality.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center text-gray-700">
                <span className="w-2 h-2 bg-lime-500 rounded-full mr-2"></span>
                Describe the problem it solves
              </div>
              <div className="flex items-center text-gray-700">
                <span className="w-2 h-2 bg-lime-500 rounded-full mr-2"></span>
                Explain the user benefit
              </div>
              <div className="flex items-center text-gray-700">
                <span className="w-2 h-2 bg-lime-500 rounded-full mr-2"></span>
                Add mockups if possible
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Getting Started */}
      <section className="bg-white py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Getting Started</h2>
          <div className="space-y-6">
            
            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-fuchsia-100 rounded-lg flex items-center justify-center font-bold text-fuchsia-600 mr-4">
                1
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Fork & Clone the Repository</h3>
                <p className="text-gray-600 mb-2">
                  Create your own fork and clone it to your local machine.
                </p>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm overflow-x-auto">
                  git clone https://github.com/YOUR_USERNAME/centenarian-os.git
                </pre>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-fuchsia-100 rounded-lg flex items-center justify-center font-bold text-fuchsia-600 mr-4">
                2
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Set Up Development Environment</h3>
                <p className="text-gray-600 mb-2">
                  Install dependencies and configure your local environment.
                </p>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm overflow-x-auto">
                  npm install{'\n'}cp .env.example .env.local{'\n'}# Add your Supabase credentials to .env.local
                </pre>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-fuchsia-100 rounded-lg flex items-center justify-center font-bold text-fuchsia-600 mr-4">
                3
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Create a Feature Branch</h3>
                <p className="text-gray-600 mb-2">
                  Never work directly on main. Create a descriptive branch name.
                </p>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm overflow-x-auto">
                  git checkout -b feature/add-nutrition-module
                </pre>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-fuchsia-100 rounded-lg flex items-center justify-center font-bold text-fuchsia-600 mr-4">
                4
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Make Changes & Test</h3>
                <p className="text-gray-600 mb-2">
                  Write clean, documented code. Run tests before committing.
                </p>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm overflow-x-auto">
                  npm run lint{'\n'}npm run type-check{'\n'}npm test
                </pre>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-10 h-10 bg-fuchsia-100 rounded-lg flex items-center justify-center font-bold text-fuchsia-600 mr-4">
                5
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Submit a Pull Request</h3>
                <p className="text-gray-600 mb-2">
                  Push your branch and open a PR with a clear description of changes.
                </p>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm overflow-x-auto">
                  git push origin feature/add-nutrition-module
                </pre>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Guidelines */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Contribution Guidelines</h2>
        <div className="bg-white rounded-xl shadow-md p-8">
          <div className="space-y-6">
            
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Code Standards</h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="text-fuchsia-600 mr-2">•</span>
                  TypeScript strict mode (no <code className="bg-gray-100 px-1 rounded">any</code> without comment)
                </li>
                <li className="flex items-start">
                  <span className="text-fuchsia-600 mr-2">•</span>
                  JSDoc comments for all exported functions
                </li>
                <li className="flex items-start">
                  <span className="text-fuchsia-600 mr-2">•</span>
                  Test coverage for new features (80%+ for business logic)
                </li>
                <li className="flex items-start">
                  <span className="text-fuchsia-600 mr-2">•</span>
                  Accessible UI (keyboard navigation, ARIA labels)
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Commit Messages</h3>
              <p className="text-gray-600 mb-2">Use Conventional Commits format:</p>
              <pre className="bg-gray-100 p-3 rounded text-sm text-gray-800">
                feat(planner): add milestone grouping{'\n'}fix(auth): prevent duplicate signups{'\n'}docs(readme): update installation steps
              </pre>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Security</h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="text-fuchsia-600 mr-2">•</span>
                  Never commit API keys or secrets
                </li>
                <li className="flex items-start">
                  <span className="text-fuchsia-600 mr-2">•</span>
                  Always validate user input
                </li>
                <li className="flex items-start">
                  <span className="text-fuchsia-600 mr-2">•</span>
                  Enable RLS on new database tables
                </li>
                <li className="flex items-start">
                  <span className="text-fuchsia-600 mr-2">•</span>
                  Report vulnerabilities to security@example.com
                </li>
              </ul>
            </div>

          </div>

          <div className="mt-8 pt-8 border-t">
            <p className="text-gray-600">
              Full guidelines in{' '}
              <a 
                href="https://github.com/dapperAuteur/centenarian-os/blob/main/CONTRIBUTING.md" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-fuchsia-600 hover:text-fuchsia-700 font-medium"
              >
                CONTRIBUTING.md
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="bg-gradient-to-r from-fuchsia-600 to-sky-600 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Heart className="w-16 h-16 text-white mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-4">
            Join Our Community
          </h2>
          <p className="text-white/90 mb-8 text-lg max-w-2xl mx-auto">
            Contributors are the heart of open source. Every contribution—big or small—makes a difference.
          </p>
          <div className="flex justify-center space-x-4">
            <a 
              href="https://github.com/dapperAuteur/centenarian-os/issues" 
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-white text-fuchsia-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
            >
              Browse Issues
            </a>
            <a 
              href="https://github.com/dapperAuteur/centenarian-os/discussions" 
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-white/10 backdrop-blur text-white border-2 border-white rounded-lg hover:bg-white/20 transition-colors font-semibold"
            >
              Join Discussions
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center">
            <p className="text-gray-600 text-sm">
              © 2025 CentenarianOS. MIT License.
            </p>
            <div className="flex space-x-6">
              <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm">
                Home
              </Link>
              <Link href="/roadmap" className="text-gray-600 hover:text-gray-900 text-sm">
                Roadmap
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}