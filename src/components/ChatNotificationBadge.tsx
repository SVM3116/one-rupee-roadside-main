import { MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ChatNotificationBadgeProps {
  unreadCount: number;
  lastMessage?: string;
  className?: string;
  onClick?: () => void;
}

export default function ChatNotificationBadge({ 
  unreadCount, 
  lastMessage,
  className,
  onClick 
}: ChatNotificationBadgeProps) {
  if (unreadCount === 0) return null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "fixed bottom-4 right-4 z-50 cursor-pointer animate-in slide-in-from-bottom-5",
        "bg-primary text-primary-foreground rounded-lg shadow-lg p-4 max-w-sm",
        "hover:shadow-xl transition-shadow",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <MessageCircle className="h-5 w-5" />
          <Badge
            variant="destructive"
            className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs font-bold animate-pulse"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">New Message{unreadCount > 1 ? 's' : ''}</div>
          {lastMessage && (
            <div className="text-xs opacity-90 truncate mt-1">
              {lastMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

