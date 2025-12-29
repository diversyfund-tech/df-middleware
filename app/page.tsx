import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <main className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold mb-4 text-zinc-900 dark:text-zinc-50">
            DF Middleware
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400">
            Centralized data synchronization between Aloware, GHL, and Verity
          </p>
        </div>

        {/* System Overview */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
            <h2 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
              Aloware
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Call center platform integration
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Connected</span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
            <h2 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
              GHL
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              CRM and contact management
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Connected</span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
            <h2 className="text-lg font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
              Verity
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Texting and messaging platform
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Connected</span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-8 shadow-sm border border-zinc-200 dark:border-zinc-700 mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
            Features
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
                Async Event Processing
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Webhook events are processed asynchronously with automatic retries and error handling
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
                Bidirectional Sync
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Contacts sync between Aloware and GHL with conflict resolution
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
                Texting Integration
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                SMS/MMS messages sync to GHL with opt-out compliance handling
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-50">
                Admin APIs
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Replay, quarantine, and manage events through admin endpoints
              </p>
            </div>
          </div>
        </div>

        {/* API Endpoints */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-8 shadow-sm border border-zinc-200 dark:border-zinc-700">
          <h2 className="text-2xl font-semibold mb-6 text-zinc-900 dark:text-zinc-50">
            API Endpoints
          </h2>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-mono text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-50">
                POST /api/webhooks/aloware
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Aloware webhook handler
              </p>
            </div>
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-mono text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-50">
                POST /api/webhooks/ghl
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                GHL webhook handler
              </p>
            </div>
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-mono text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-50">
                POST /api/webhooks/texting
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Verity texting webhook handler
              </p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-mono text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-50">
                GET /api/health
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Health check endpoint
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            For documentation and setup instructions, see the{" "}
            <Link
              href="https://github.com/diversyfund-tech/df-middleware"
              className="text-blue-600 dark:text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub repository
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
