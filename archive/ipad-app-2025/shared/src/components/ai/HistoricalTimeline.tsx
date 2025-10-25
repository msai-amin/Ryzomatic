/**
 * Historical Timeline Component
 * Displays historical events and context in an interactive timeline
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  HistoricalContext, 
  HistoricalEvent 
} from '../../services/ai/historicalContextService';
import { Calendar, Clock, Sparkles, BookOpen, Users, Globe } from 'lucide-react';

interface HistoricalTimelineProps {
  context: HistoricalContext;
  height?: number;
  className?: string;
  onEventClick?: (event: HistoricalEvent) => void;
}

export const HistoricalTimeline: React.FC<HistoricalTimelineProps> = ({
  context,
  height = 500,
  className = '',
  onEventClick
}) => {
  const [selectedEvent, setSelectedEvent] = useState<HistoricalEvent | null>(null);
  const [filter, setFilter] = useState<HistoricalEvent['category'] | 'all'>('all');
  
  // Filter events based on selected category
  const filteredEvents = filter === 'all' 
    ? context.events 
    : context.events.filter(evt => evt.category === filter);

  // Sort events by year
  const sortedEvents = [...filteredEvents].sort((a, b) => a.year - b.year);

  const handleEventClick = (event: HistoricalEvent) => {
    setSelectedEvent(event);
    onEventClick?.(event);
  };

  // Get color for event category
  const getCategoryColor = (category: HistoricalEvent['category']) => {
    const colors = {
      personal: 'bg-purple-100 text-purple-800 border-purple-300',
      political: 'bg-red-100 text-red-800 border-red-300',
      cultural: 'bg-blue-100 text-blue-800 border-blue-300',
      intellectual: 'bg-green-100 text-green-800 border-green-300',
      publication: 'bg-amber-100 text-amber-800 border-amber-300'
    };
    return colors[category];
  };

  // Get icon for event category
  const getCategoryIcon = (category: HistoricalEvent['category']) => {
    const icons = {
      personal: Users,
      political: Globe,
      cultural: Sparkles,
      intellectual: BookOpen,
      publication: BookOpen
    };
    const Icon = icons[category];
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className={`historical-timeline bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Historical Context: {context.author}
          </h3>
        </div>
        {context.workTitle && (
          <p className="text-sm text-gray-600 mb-2">
            Work: <strong>{context.workTitle}</strong>
            {context.publicationYear && ` (${context.publicationYear})`}
          </p>
        )}
        <p className="text-sm text-gray-600">
          Period: {context.period} • Movement: {context.intellectualMovement}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All Events ({context.events.length})
          </button>
          {(['personal', 'political', 'cultural', 'intellectual', 'publication'] as const).map(cat => {
            const count = context.events.filter(e => e.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1 text-xs rounded-full capitalize transition-colors ${
                  filter === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="p-4" style={{ maxHeight: height, overflowY: 'auto' }}>
        {sortedEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No events found for this category</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-purple-200 to-pink-200" />

            {/* Events */}
            <div className="space-y-6">
              {sortedEvents.map((event, index) => (
                <div 
                  key={event.id}
                  className="relative pl-16 group cursor-pointer"
                  onClick={() => handleEventClick(event)}
                >
                  {/* Timeline dot */}
                  <div className={`absolute left-6 w-5 h-5 rounded-full border-2 ${
                    getCategoryColor(event.category)
                  } bg-white flex items-center justify-center group-hover:scale-125 transition-transform`}
                    style={{ 
                      width: `${Math.max(20, event.importance * 2)}px`,
                      height: `${Math.max(20, event.importance * 2)}px`,
                      left: `${32 - Math.max(10, event.importance)}px`
                    }}
                  >
                    <div className="text-xs">
                      {getCategoryIcon(event.category)}
                    </div>
                  </div>

                  {/* Event card */}
                  <div className={`border-2 rounded-lg p-3 transition-all group-hover:shadow-md ${
                    selectedEvent?.id === event.id 
                      ? `${getCategoryColor(event.category)} shadow-md`
                      : 'bg-white border-gray-200 hover:border-blue-300'
                  }`}>
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {event.title}
                      </h4>
                      <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                        {event.year}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {event.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        getCategoryColor(event.category)
                      }`}>
                        {event.category}
                      </span>
                      <span className="text-xs text-gray-500">
                        Importance: {'⭐'.repeat(Math.min(event.importance, 10) / 2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Context panel */}
      {selectedEvent && (
        <div className="p-4 border-t border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <h4 className="font-semibold text-gray-900 mb-2">
            {selectedEvent.title}
          </h4>
          <p className="text-sm text-gray-700 mb-2">
            <strong>Date:</strong> {selectedEvent.date} ({selectedEvent.year})
          </p>
          <p className="text-sm text-gray-600 mb-2">
            {selectedEvent.description}
          </p>
          {selectedEvent.source && (
            <p className="text-xs text-gray-500">
              Source: {selectedEvent.source}
            </p>
          )}
        </div>
      )}

      {/* Cultural context */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-500" />
          Cultural Context
        </h4>
        <p className="text-sm text-gray-600 mb-3">
          {context.culturalContext}
        </p>
        
        {context.relatedFigures.length > 0 && (
          <div>
            <h5 className="font-medium text-gray-900 mb-1 text-sm flex items-center gap-1">
              <Users className="w-4 h-4" />
              Related Figures
            </h5>
            <div className="flex flex-wrap gap-1">
              {context.relatedFigures.map((figure, idx) => (
                <span 
                  key={idx}
                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                >
                  {figure}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sources */}
      {context.sources.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-white">
          <h5 className="text-xs font-medium text-gray-700 mb-2">Sources:</h5>
          <div className="space-y-1">
            {context.sources.map((source, idx) => (
              <a 
                key={idx}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline block"
              >
                {source.title} →
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
        <p>💡 <strong>Tip:</strong> Click on events to see more details • Use filters to focus on specific categories</p>
      </div>
    </div>
  );
};

