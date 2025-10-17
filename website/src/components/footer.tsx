'use client'
import Link from 'next/link'
import { Github, Heart } from 'lucide-react'
import Logo from './logo'
import DiscordIcon from './icons/discord'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative bg-gray-900 text-gray-300">
      {/* Decorative gradient line */}
      <div className="h-1 w-full bg-gradient-to-r from-purple-600 via-blue-500 to-orange-400"></div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand Section */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center">
              <div className="relative h-12 w-12">
                <Logo />
              </div>
              <span className="ml-2 text-xl font-bold text-white">
                EmbedPDF
              </span>
            </Link>
            <p className="mt-4 text-sm text-gray-400">
              The open-source PDF viewer for modern web applications. Fast,
              customizable, and framework-agnostic.
            </p>
            <div className="mt-6 flex space-x-4">
              <a
                href="https://github.com/embedpdf/embed-pdf-viewer"
                target="_blank"
                rel="noreferrer"
                className="group rounded-lg bg-gray-800 p-2 transition-colors hover:bg-gray-700"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5 text-gray-300 transition-colors group-hover:text-white" />
              </a>
              <a
                href="https://discord.gg/mHHABmmuVU"
                target="_blank"
                rel="noreferrer"
                className="group rounded-lg bg-gray-800 p-2 transition-colors hover:bg-indigo-600"
                aria-label="Discord"
              >
                <DiscordIcon
                  size={20}
                  strokeColor="rgb(209 213 219)"
                  className="transition-colors group-hover:stroke-white"
                />
              </a>
            </div>
          </div>

          {/* Frameworks Section */}
          <div>
            <h3 className="tracking-wider mb-4 text-sm font-semibold uppercase text-white">
              Frameworks
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/react-pdf-viewer"
                  className="group inline-flex items-center text-sm transition-colors hover:text-white"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500 transition-transform group-hover:scale-150"></span>
                  <span className="ml-2">React PDF Viewer</span>
                </Link>
              </li>
              {/*<li>
                <Link
                  href="/vue-pdf-viewer"
                  className="group inline-flex items-center text-sm transition-colors hover:text-white"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 transition-transform group-hover:scale-150"></span>
                  <span className="ml-2">Vue PDF Viewer</span>
                </Link>
              </li>*/}
            </ul>
          </div>

          {/* Resources Section */}
          <div>
            <h3 className="tracking-wider mb-4 text-sm font-semibold uppercase text-white">
              Resources
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/docs"
                  className="group inline-flex items-center text-sm transition-colors hover:text-white"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 transition-transform group-hover:scale-150"></span>
                  <span className="ml-2">Documentation</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/tools"
                  className="group inline-flex items-center text-sm transition-colors hover:text-white"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400 transition-transform group-hover:scale-150"></span>
                  <span className="ml-2">Tools</span>
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/embedpdf/embed-pdf-viewer"
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center text-sm transition-colors hover:text-white"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-500 transition-transform group-hover:scale-150"></span>
                  <span className="ml-2">GitHub Repository</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Community Section */}
          <div>
            <h3 className="tracking-wider mb-4 text-sm font-semibold uppercase text-white">
              Community
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/sponsorship"
                  className="group inline-flex items-center text-sm transition-colors hover:text-white"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-pink-500 transition-transform group-hover:scale-150"></span>
                  <span className="ml-2">Sponsorship</span>
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/embedpdf/embed-pdf-viewer/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center text-sm transition-colors hover:text-white"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 transition-transform group-hover:scale-150"></span>
                  <span className="ml-2">Report Issues</span>
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/embedpdf/embed-pdf-viewer/discussions"
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center text-sm transition-colors hover:text-white"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 transition-transform group-hover:scale-150"></span>
                  <span className="ml-2">Discussions</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-gray-800 pt-8">
          <div className="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
            <p className="text-sm text-gray-400">
              © {currentYear} EmbedPDF. Released under the MIT License.
            </p>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <span>Made with</span>
              <Heart className="h-4 w-4 fill-red-500 text-red-500" />
              <span>by the open-source community</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
