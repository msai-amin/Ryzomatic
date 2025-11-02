import React, { useEffect, useState } from 'react';
import { Plus, Target, Flame, CheckCircle } from 'lucide-react';
import { readingGoalsService, ReadingGoal } from '../../services/readingGoalsService';

interface ReadingGoalsWidgetProps {
  className?: string;
}

export const ReadingGoalsWidget: React.FC<ReadingGoalsWidgetProps> = ({
  className = ''
}) => {
  const [goals, setGoals] = useState<ReadingGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadGoals = async () => {
      try {
        setIsLoading(true);
        const data = await readingGoalsService.getActiveGoals();
        setGoals(data);
      } catch (error) {
        console.error('Failed to load reading goals:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadGoals();
  }, []);

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${className}`}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          Reading Goals
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          No goals set. Create one to start tracking your progress!
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <Target className="w-4 h-4" />
          Reading Goals
        </h3>
        <button
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          title="Create new goal"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-3">
        {goals.map(goal => (
          <GoalProgressBar key={goal.id} goal={goal} />
        ))}
      </div>
    </div>
  );
};

interface GoalProgressBarProps {
  goal: ReadingGoal;
}

const GoalProgressBar: React.FC<GoalProgressBarProps> = ({ goal }) => {
  const progress = goal.target_value > 0 
    ? Math.min((goal.current_value / goal.target_value) * 100, 100)
    : 0;
  
  const isCompleted = goal.completed || progress >= 100;

  const getGoalTypeLabel = (type: ReadingGoal['goal_type']) => {
    switch (type) {
      case 'books_read': return 'Books Read';
      case 'pages_read': return 'Pages Read';
      case 'minutes_studied': return 'Minutes Studied';
      case 'notes_created': return 'Notes Created';
      case 'sessions_completed': return 'Sessions Completed';
      default: return type;
    }
  };

  const getPeriodLabel = (period: ReadingGoal['period']) => {
    return period.charAt(0).toUpperCase() + period.slice(1);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium flex items-center gap-1" style={{ color: 'var(--color-text-primary)' }}>
          {isCompleted && <CheckCircle className="w-3 h-3 text-green-500" />}
          {getGoalTypeLabel(goal.goal_type)}
        </span>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
          {goal.streak_days > 0 && (
            <>
              <Flame className="w-3 h-3 text-orange-500" />
              <span>{goal.streak_days} days</span>
            </>
          )}
          <span>{goal.current_value} / {goal.target_value}</span>
        </span>
      </div>
      
      <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
        <div 
          className="h-full rounded-full transition-all duration-300"
          style={{ 
            width: `${progress}%`,
            backgroundColor: isCompleted ? '#10B981' : '#3B82F6'
          }}
        />
      </div>
      
      <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        {getPeriodLabel(goal.period)} goal
      </div>
    </div>
  );
};

