'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { section: 'Dashboards', items: [
    { href: '/dashboard/board', label: 'Board (Tier 1)', icon: '📊' },
    { href: '/dashboard/team', label: 'Team (Tier 3)', icon: '👥' },
  ]},
  { section: 'Fleet', items: [
    { href: '/agents', label: 'Agent Registry', icon: '🤖' },
  ]},
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">🏛️ AI Governance</h1>
        <p className="text-xs text-gray-500 mt-1">Enterprise Monitoring</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {NAV_ITEMS.map(({ section, items }) => (
          <div key={section}>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{section}</p>
            <ul className="space-y-1">
              {items.map(({ href, label, icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      pathname === href
                        ? 'bg-white text-gray-900 shadow-sm font-medium'
                        : 'text-gray-600 hover:bg-white hover:text-gray-900'
                    )}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-400"></span>
          <span>API Connected</span>
        </div>
      </div>
    </aside>
  );
}
