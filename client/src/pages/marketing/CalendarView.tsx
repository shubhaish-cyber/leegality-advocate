import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { truncate } from '../../lib/utils';

interface Post {
  id: string;
  caption: string;
  status: string;
  scheduledFor: string | null;
  createdAt: string;
  campaignTag: string | null;
}

interface CalendarViewProps {
  posts: Post[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const statusColor: Record<string, string> = {
  active: 'bg-green-500',
  draft: 'bg-navy-300',
  archived: 'bg-red-400',
};

const statusBg: Record<string, string> = {
  active: 'bg-green-50 border-green-200 hover:bg-green-100',
  draft: 'bg-navy-50 border-navy-200 hover:bg-navy-100',
  archived: 'bg-red-50 border-red-200 hover:bg-red-100',
};

export function CalendarView({ posts }: CalendarViewProps) {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const monthLabel = new Date(year, month).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Group posts by day
  const postsByDay = new Map<number, Post[]>();
  posts.forEach((post) => {
    const dateStr = post.scheduledFor || post.createdAt;
    const date = new Date(dateStr);
    if (date.getFullYear() === year && date.getMonth() === month) {
      const day = date.getDate();
      if (!postsByDay.has(day)) postsByDay.set(day, []);
      postsByDay.get(day)!.push(post);
    }
  });

  const prevMonth = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  const goToToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const isToday = (day: number) =>
    day === now.getDate() && month === now.getMonth() && year === now.getFullYear();

  // Build grid cells: blanks for days before the first + actual days
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-navy-100">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-navy-50 text-navy-500 cursor-pointer transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold text-navy-900 w-48 text-center">{monthLabel}</h2>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-navy-50 text-navy-500 cursor-pointer transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          onClick={goToToday}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-accent-50 text-accent-600 hover:bg-accent-100 cursor-pointer transition-colors"
        >
          Today
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-navy-100">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-2.5 text-center text-xs font-medium text-navy-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const dayPosts = day ? postsByDay.get(day) || [] : [];
          return (
            <div
              key={idx}
              className={`min-h-[110px] border-b border-r border-navy-100 p-1.5 ${
                day === null ? 'bg-navy-50/50' : ''
              } ${isToday(day!) ? 'bg-accent-50/40' : ''}`}
            >
              {day !== null && (
                <>
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
                      isToday(day)
                        ? 'bg-accent-500 text-white'
                        : 'text-navy-500'
                    }`}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayPosts.slice(0, 3).map((post) => (
                      <button
                        key={post.id}
                        onClick={() => navigate(`/marketing/posts/${post.id}`)}
                        className={`w-full text-left px-1.5 py-1 rounded border text-[11px] leading-tight truncate cursor-pointer transition-colors ${
                          statusBg[post.status] || 'bg-navy-50 border-navy-200 hover:bg-navy-100'
                        }`}
                        title={post.caption}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${statusColor[post.status] || 'bg-navy-300'}`} />
                        {truncate(post.caption, 24)}
                      </button>
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="text-[10px] text-navy-400 pl-1">+{dayPosts.length - 3} more</p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 p-3 border-t border-navy-100 bg-navy-50/30">
        <span className="text-xs text-navy-400">Status:</span>
        {Object.entries({ active: 'Active', draft: 'Draft', archived: 'Archived' }).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-navy-500">
            <span className={`w-2 h-2 rounded-full ${statusColor[key]}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
