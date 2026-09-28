import { useState, useMemo } from 'react';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'tables-filtering')!;

interface Employee {
  id: number;
  name: string;
  department: string;
  role: string;
  status: 'Active' | 'On Leave' | 'Terminated';
  joined: string;
}

const EMPLOYEES: Employee[] = [
  {
    id: 1,
    name: 'Alice Chen',
    department: 'Engineering',
    role: 'Senior Engineer',
    status: 'Active',
    joined: '2021-03-15',
  },
  {
    id: 2,
    name: 'Bob Smith',
    department: 'Design',
    role: 'UX Designer',
    status: 'Active',
    joined: '2020-07-01',
  },
  {
    id: 3,
    name: 'Carol Davis',
    department: 'Engineering',
    role: 'Tech Lead',
    status: 'On Leave',
    joined: '2019-11-20',
  },
  {
    id: 4,
    name: 'David Lee',
    department: 'Product',
    role: 'Product Manager',
    status: 'Active',
    joined: '2022-01-10',
  },
  {
    id: 5,
    name: 'Eva Martinez',
    department: 'Engineering',
    role: 'Junior Engineer',
    status: 'Active',
    joined: '2023-06-05',
  },
  {
    id: 6,
    name: 'Frank Wilson',
    department: 'Sales',
    role: 'Account Executive',
    status: 'Terminated',
    joined: '2018-04-22',
  },
  {
    id: 7,
    name: 'Grace Kim',
    department: 'Design',
    role: 'Visual Designer',
    status: 'Active',
    joined: '2021-09-14',
  },
  {
    id: 8,
    name: 'Hank Patel',
    department: 'Engineering',
    role: 'DevOps Engineer',
    status: 'Active',
    joined: '2020-02-28',
  },
  {
    id: 9,
    name: 'Iris Johnson',
    department: 'HR',
    role: 'HR Manager',
    status: 'Active',
    joined: '2017-08-03',
  },
  {
    id: 10,
    name: 'Jack Brown',
    department: 'Product',
    role: 'Product Analyst',
    status: 'On Leave',
    joined: '2022-11-01',
  },
  {
    id: 11,
    name: 'Karen White',
    department: 'Engineering',
    role: 'QA Engineer',
    status: 'Active',
    joined: '2021-05-19',
  },
  {
    id: 12,
    name: 'Leo Garcia',
    department: 'Sales',
    role: 'Sales Manager',
    status: 'Active',
    joined: '2019-03-07',
  },
  {
    id: 13,
    name: 'Mia Thompson',
    department: 'Design',
    role: 'Brand Designer',
    status: 'Active',
    joined: '2023-02-14',
  },
  {
    id: 14,
    name: 'Noah Anderson',
    department: 'Engineering',
    role: 'Backend Engineer',
    status: 'Active',
    joined: '2020-10-30',
  },
  {
    id: 15,
    name: 'Olivia Taylor',
    department: 'HR',
    role: 'Recruiter',
    status: 'Active',
    joined: '2022-07-22',
  },
  {
    id: 16,
    name: 'Paul Harris',
    department: 'Engineering',
    role: 'Frontend Engineer',
    status: 'Active',
    joined: '2021-12-01',
  },
  {
    id: 17,
    name: 'Quinn Moore',
    department: 'Product',
    role: 'UX Researcher',
    status: 'Terminated',
    joined: '2018-09-15',
  },
  {
    id: 18,
    name: 'Rachel Clark',
    department: 'Sales',
    role: 'SDR',
    status: 'Active',
    joined: '2023-04-03',
  },
  {
    id: 19,
    name: 'Sam Lewis',
    department: 'Engineering',
    role: 'Staff Engineer',
    status: 'Active',
    joined: '2016-06-20',
  },
  {
    id: 20,
    name: 'Tina Robinson',
    department: 'Design',
    role: 'Design Lead',
    status: 'Active',
    joined: '2020-01-13',
  },
  {
    id: 21,
    name: 'Uma Scott',
    department: 'Engineering',
    role: 'Security Engineer',
    status: 'On Leave',
    joined: '2022-03-18',
  },
  {
    id: 22,
    name: 'Victor Young',
    department: 'Sales',
    role: 'Enterprise AE',
    status: 'Active',
    joined: '2019-08-09',
  },
  {
    id: 23,
    name: 'Wendy Hall',
    department: 'HR',
    role: 'People Ops',
    status: 'Active',
    joined: '2021-11-25',
  },
];

const DEPARTMENTS = ['All', 'Engineering', 'Design', 'Product', 'Sales', 'HR'];
const PAGE_SIZE = 7;
type SortKey = 'name' | 'department' | 'status' | 'joined';
type SortDir = 'asc' | 'desc';

const statusColor: Record<Employee['status'], string> = {
  Active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'On Leave': 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  Terminated: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
};

function employeeMatchesSearch(employee: Employee, search: string): boolean {
  const normalizedSearch = search.toLowerCase();
  return (
    employee.name.toLowerCase().includes(normalizedSearch) ||
    employee.role.toLowerCase().includes(normalizedSearch)
  );
}

function compareEmployees(a: Employee, b: Employee, sortKey: SortKey, sortDir: SortDir): number {
  const left = a[sortKey];
  const right = b[sortKey];
  const direction = sortDir === 'asc' ? 1 : -1;

  if (left === right) return 0;
  return left < right ? -direction : direction;
}

function SortableHeader({
  col,
  label,
  ariaName,
  sortKey,
  sortDir,
  onSort,
}: {
  col: SortKey;
  label: string;
  ariaName: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (col: SortKey) => void;
}) {
  const isActive = sortKey === col;
  const nextDir = isActive && sortDir === 'asc' ? 'descending' : 'ascending';
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className="font-semibold text-muted hover:text-accent"
      aria-label={`Sort by ${ariaName} ${nextDir}`}
    >
      {label}
      {isActive && (
        <span aria-hidden="true" className="ml-1">
          {sortDir === 'asc' ? '▲' : '▼'}
        </span>
      )}
    </button>
  );
}

export function TablesFiltering() {
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [actionRow, setActionRow] = useState<number | null>(null);
  const [deleted, setDeleted] = useState<Set<number>>(() => new Set());
  const [notification, setNotification] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let rows = EMPLOYEES.filter((e) => !deleted.has(e.id));
    if (query) {
      rows = rows.filter((employee) => employeeMatchesSearch(employee, query));
    }
    if (dept !== 'All') rows = rows.filter((e) => e.department === dept);
    return [...rows].sort((a, b) => compareEmployees(a, b, sortKey, sortDir));
  }, [query, dept, sortKey, sortDir, deleted]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleDelete = (id: number) => {
    setDeleted((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setActionRow(null);
    const emp = EMPLOYEES.find((e) => e.id === id);
    setNotification(`${emp?.name ?? 'Employee'} removed.`);
    setTimeout(() => setNotification(null), 2500);
  };

  return (
    <div>
      <LabHeader lab={lab} />

      <p className="mb-6 text-sm text-muted">
        Practice{' '}
        <code className="rounded bg-surface-raised px-1 text-xs">getByRole('row').filter()</code>,{' '}
        <code className="rounded bg-surface-raised px-1 text-xs">locator.nth()</code>, and asserting
        sort order across pages.
      </p>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="employee-search" className="text-xs font-medium text-muted">
            Search
          </label>
          <input
            id="employee-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Name or role…"
            className="rounded-lg border border-edge px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="department-filter" className="text-xs font-medium text-muted">
            Department
          </label>
          <select
            id="department-filter"
            value={dept}
            onChange={(e) => {
              setDept(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-edge px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status */}
      <p role="status" className="mb-3 text-sm text-muted">
        {filtered.length === 0 ? 'No employees found.' : `${filtered.length} employees`}
      </p>

      {notification && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-3 rounded-lg bg-surface-raised px-3 py-2 text-sm text-content"
        >
          {notification}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full text-sm">
          <thead className="border-b border-edge bg-canvas">
            <tr>
              <th className="px-4 py-3 text-left">
                <SortableHeader
                  col="name"
                  label="Name"
                  ariaName="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </th>
              <th className="px-4 py-3 text-left">
                <SortableHeader
                  col="department"
                  label="Department"
                  ariaName="department"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted">Role</th>
              <th className="px-4 py-3 text-left">
                <SortableHeader
                  col="status"
                  label="Status"
                  ariaName="status"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </th>
              <th className="px-4 py-3 text-left">
                <SortableHeader
                  col="joined"
                  label="Joined"
                  ariaName="joined date"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge bg-surface">
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                  No employees match your filters.
                </td>
              </tr>
            ) : (
              pageRows.map((emp) => (
                <tr key={emp.id} className="hover:bg-canvas">
                  <td className="px-4 py-3 font-medium text-content">{emp.name}</td>
                  <td className="px-4 py-3 text-muted">{emp.department}</td>
                  <td className="px-4 py-3 text-muted">{emp.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor[emp.status]}`}
                    >
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{emp.joined}</td>
                  <td className="relative px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setActionRow(actionRow === emp.id ? null : emp.id)}
                      aria-haspopup="true"
                      aria-expanded={actionRow === emp.id}
                      aria-label={`Actions for ${emp.name}`}
                      className="rounded px-2 py-1 text-xs font-medium text-muted hover:bg-surface-raised"
                    >
                      ⋯
                    </button>
                    {actionRow === emp.id && (
                      <div
                        role="menu"
                        aria-label={`${emp.name} actions`}
                        className="absolute right-2 z-10 mt-1 w-32 rounded-lg border border-edge bg-surface shadow-lg"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setActionRow(null);
                            setNotification(`Editing ${emp.name}…`);
                            setTimeout(() => setNotification(null), 1500);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-canvas"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleDelete(emp.id)}
                          className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <nav
        aria-label="Employee table pagination"
        className="mt-4 flex items-center justify-between gap-2"
      >
        <p className="text-sm text-muted">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-canvas"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              aria-current={n === page ? 'page' : undefined}
              className={[
                'rounded-lg border px-3 py-1.5 text-sm',
                n === page
                  ? 'border-brand-500 bg-brand-600 text-white'
                  : 'border-edge text-muted hover:bg-canvas',
              ].join(' ')}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-canvas"
          >
            Next
          </button>
        </div>
      </nav>
    </div>
  );
}
