import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import ChatWindow from './ChatWindow';

interface ChatButtonProps {
  requestId: string;
  userId: string;
  unreadCount?: number;
  onOpen?: () => void;
  onClose?: () => void;
  senderType?: 'user' | 'mechanic';
  className?: string;
}

export default function ChatButton({ requestId, userId, unreadCount = 0, onOpen, onClose, senderType = 'user', className }: ChatButtonProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    // Call onOpen only when opening (not when closing)
    if (isOpen && onOpen) {
      // Call immediately to update openChatRequestId ref in notifications
      onOpen();
    } else if (!isOpen && onClose) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={`gap-2 relative ${className || ''}`}>
          <MessageCircle className="h-4 w-4" />
          Chat
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Chat</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6">
          {open && ( // Only render ChatWindow when dialog is open to prevent re-renders
            <ChatWindow
              requestId={requestId}
              userId={userId}
              onMarkAsRead={onOpen}
              senderType={senderType}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

