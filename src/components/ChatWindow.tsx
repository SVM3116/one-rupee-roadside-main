import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  request_id: string;
  sender_id: string;
  sender_type: 'user' | 'mechanic';
  message: string;
  read_at: string | null;
  created_at: string;
}

interface ChatWindowProps {
  requestId: string;
  userId: string;
  className?: string;
  onMarkAsRead?: () => void;
  senderType?: 'user' | 'mechanic';
}

export default function ChatWindow({ requestId, userId, className, onMarkAsRead, senderType = 'user' }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const onMarkAsReadRef = useRef(onMarkAsRead);
  const hasMarkedAsReadRef = useRef(false);

  // Update ref when callback changes
  useEffect(() => {
    onMarkAsReadRef.current = onMarkAsRead;
  }, [onMarkAsRead]);

  // Fetch initial messages and mark as read when opened (only once)
  useEffect(() => {
    let channel: any = null;
    let mounted = true;

    const init = async () => {
      // Fetch messages
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('request_id', requestId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        
        if (mounted) {
          setMessages(data || []);
          
          // Mark messages as read when chat is opened (only once)
          if (!hasMarkedAsReadRef.current && onMarkAsReadRef.current) {
            hasMarkedAsReadRef.current = true;
            onMarkAsReadRef.current();
          }
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }

      // Subscribe to new messages
      if (mounted) {
        channel = supabase
          .channel(`chat:${requestId}-${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'chat_messages',
              filter: `request_id=eq.${requestId}`,
            },
            (payload) => {
              if (!mounted) return;

              const newMsg = payload.new as ChatMessage;
              
              // Check if message already exists (prevent duplicates)
              // Also remove any temporary messages that match this one
              setMessages((prev) => {
                // Remove temporary messages that match this one
                const withoutTemp = prev.filter((m) => {
                  if (m.id.startsWith('temp-')) {
                    // Check if temp message matches new message
                    return !(
                      m.message === newMsg.message &&
                      m.sender_id === newMsg.sender_id &&
                      Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 5000
                    );
                  }
                  return true;
                });
                
                // Check if this message already exists
                const exists = withoutTemp.some((m) => m.id === newMsg.id);
                if (exists) {
                  return withoutTemp;
                }
                
                // Add new message
                return [...withoutTemp, newMsg];
              });
              
              // Scroll to bottom after a small delay to ensure DOM update
              setTimeout(() => {
                if (messagesEndRef.current) {
                  messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 100);
              
              // Don't mark as read on every message - only mark when chat opens
              // Marking on every message causes re-renders and blinking
            }
          )
          .subscribe((status) => {
            console.log('📡 ChatWindow subscription status:', status);
          });
      }
    };

    init();

    return () => {
      mounted = false;
      hasMarkedAsReadRef.current = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [requestId, userId]); // Remove onMarkAsRead from dependencies

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current && scrollAreaRef.current) {
      // Use scrollTop for more reliable scrolling
      setTimeout(() => {
        if (messagesEndRef.current && scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [messages.length]); // Only depend on length, not the entire array


  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      const messageText = newMessage.trim();
      if (!messageText) return;
      
      setSending(true);
      
      // Optimistic update - add message immediately to sender's view
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: ChatMessage = {
        id: tempId,
        request_id: requestId,
        sender_id: userId,
        sender_type: senderType,
        message: messageText,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      
      setMessages((prev) => [...prev, optimisticMessage]);
      setNewMessage('');
      
      // Scroll to bottom immediately
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({
            request_id: requestId,
            sender_id: userId,
            sender_type: senderType,
            message: messageText,
          })
          .select()
          .single();

        if (error) throw error;
        
        // Replace optimistic message with real one
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempId);
          // Check if message already exists (from subscription)
          const exists = filtered.some((m) => m.id === data.id);
          if (!exists) {
            return [...filtered, data as ChatMessage];
          }
          return filtered;
        });
      } catch (error) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        throw error;
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className={cn('flex flex-col h-[500px]', className)}>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <div 
          ref={scrollAreaRef}
          className="flex-1 overflow-y-auto p-4 min-h-0"
          style={{ maxHeight: '400px', scrollBehavior: 'smooth' }}
        >
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const isOwn = msg.sender_id === userId;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      isOwn ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-lg px-4 py-2 break-words',
                        isOwn
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      <p
                        className={cn(
                          'text-xs mt-1',
                          isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground/70'
                        )}
                      >
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={sending}
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

