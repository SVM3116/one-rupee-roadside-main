import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  request_id: string;
  sender_id: string;
  sender_type: 'user' | 'mechanic';
  message: string;
  read_at: string | null;
  created_at: string;
}

interface UnreadChat {
  requestId: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
  senderType: 'user' | 'mechanic';
}

export const useChatNotifications = (userId: string | null, userRole: 'user' | 'mechanic' | null) => {
  const [unreadChats, setUnreadChats] = useState<Map<string, UnreadChat>>(new Map());
  const [openChatRequestId, setOpenChatRequestId] = useState<string | null>(null);
  const openChatRequestIdRef = useRef<string | null>(null);
  const [latestNotification, setLatestNotification] = useState<{ requestId: string; message: string; senderName: string } | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    openChatRequestIdRef.current = openChatRequestId;
    // Clear latest notification when chat opens
    if (openChatRequestId && latestNotification?.requestId === openChatRequestId) {
      setLatestNotification(null);
    }
  }, [openChatRequestId, latestNotification]);

  // Fetch jobs/requests that this user can chat about
  const fetchChatableRequests = useCallback(async () => {
    if (!userId || !userRole) return [];

    try {
      if (userRole === 'mechanic') {
        // For mechanics: get all jobs assigned to them
        const { data: jobs, error } = await supabase
          .from('job_requests')
          .select('id, user_id, mechanic_id, vehicle_type, issue_description')
          .eq('mechanic_id', userId)
          .in('status', ['pending', 'accepted', 'on_the_way', 'reached_destination', 'repair_started', 'repair_completed']);

        if (error) throw error;
        return jobs || [];
      } else {
        // For users: get all their job requests that have a mechanic assigned
        const { data: jobs, error } = await supabase
          .from('job_requests')
          .select('id, user_id, mechanic_id, vehicle_type, issue_description')
          .eq('user_id', userId)
          .not('mechanic_id', 'is', null)
          .in('status', ['pending', 'accepted', 'on_the_way', 'reached_destination', 'repair_started', 'repair_completed']);

        if (error) throw error;
        return jobs || [];
      }
    } catch (error) {
      console.error('Error fetching chatable requests:', error);
      return [];
    }
  }, [userId, userRole]);

  // Subscribe to new messages
  useEffect(() => {
    if (!userId || !userRole) return;

    console.log('🔔 Setting up chat notifications for:', { userId, userRole });

    let channel: any = null;
    let mounted = true;

    // Set up subscription for all chat messages
    // We'll filter client-side to only show notifications for relevant requests
    channel = supabase
      .channel(`chat-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        async (payload) => {
          if (!mounted) return;

          console.log('🔔 [useChatNotifications] Raw payload received:', payload);

          const newMessage = payload.new as ChatMessage;
          
          if (!newMessage) {
            console.warn('⚠️ [useChatNotifications] No message data in payload');
            return;
          }

          console.log('📨 [useChatNotifications] Processing message:', {
            messageId: newMessage.id,
            requestId: newMessage.request_id,
            senderId: newMessage.sender_id,
            currentUserId: userId,
            message: newMessage.message?.substring(0, 50)
          });
          
          // Check if message is from the other party (not from current user)
          const isFromOtherParty = newMessage.sender_id !== userId;
          // Use ref to check if chat is open (avoids dependency issues)
          const isChatOpen = openChatRequestIdRef.current === newMessage.request_id;

          console.log('🔍 [useChatNotifications] Message check:', {
            isFromOtherParty,
            isChatOpen,
            openChatRequestId: openChatRequestIdRef.current
          });

          if (!isFromOtherParty) {
            // Don't show notification for own messages
            console.log('⏭️ [useChatNotifications] Skipping - message from self');
            return;
          }

          // Check if this request is chatable by fetching requests
          // Use a more efficient check by querying the request
          try {
            const { data: request, error } = await supabase
              .from('job_requests')
              .select('id, user_id, mechanic_id, vehicle_type, issue_description')
              .eq('id', newMessage.request_id)
              .single();

            if (error || !request) {
              // Request not found or not accessible
              return;
            }

            // Check if current user is involved in this request
            const isUserInvolved = request.user_id === userId || request.mechanic_id === userId;
            if (!isUserInvolved) {
              return;
            }

             console.log('📨 New chat message received:', {
               messageId: newMessage.id,
               requestId: newMessage.request_id,
               senderId: newMessage.sender_id,
               isFromOtherParty,
               isChatOpen,
               openChatRequestId: openChatRequestIdRef.current,
               message: newMessage.message.substring(0, 50)
             });

             // Get sender name
             let senderName = 'Someone';
             try {
               const { data: profile } = await supabase
                 .from('profiles')
                 .select('full_name, email')
                 .eq('id', newMessage.sender_id)
                 .single();
               
               if (profile) {
                 senderName = profile.full_name || profile.email?.split('@')[0] || 'Someone';
               }
             } catch (err) {
               console.error('Error fetching sender profile:', err);
             }

             // Always show notification when message is from other party and chat is not open
             if (!isChatOpen) {
               console.log('📢 Showing notification - chat is closed');
               
               // Show toast notification
               toast.success(`💬 New message from ${senderName}`, {
                 description: `${newMessage.message.substring(0, 100)}${newMessage.message.length > 100 ? '...' : ''}`,
                 duration: 5000,
                 action: {
                   label: 'Open Chat',
                   onClick: () => {
                     console.log('🔓 Opening chat from notification:', newMessage.request_id);
                     setOpenChatRequestId(newMessage.request_id);
                   }
                 },
                 position: 'top-right',
               });

               // Set latest notification for badge display
               setLatestNotification({
                 requestId: newMessage.request_id,
                 message: newMessage.message,
                 senderName
               });

               // Auto-hide notification badge after 5 seconds
               setTimeout(() => {
                 setLatestNotification((prev) => 
                   prev?.requestId === newMessage.request_id ? null : prev
                 );
               }, 5000);
             } else {
               console.log('⏭️ Skipping notification - chat is open');
             }
            
            // Always update unread count (even if chat is open - in case user closes it)
            // But only increment if chat is not open
            setUnreadChats((prev) => {
              const newMap = new Map(prev);
              const existing = newMap.get(newMessage.request_id) || {
                requestId: newMessage.request_id,
                unreadCount: 0,
                lastMessage: '',
                lastMessageTime: '',
                senderType: 'user' as const
              };
              
              newMap.set(newMessage.request_id, {
                ...existing,
                unreadCount: isChatOpen ? existing.unreadCount : existing.unreadCount + 1,
                lastMessage: newMessage.message,
                lastMessageTime: newMessage.created_at,
                senderType: newMessage.sender_type
              });
              
              return newMap;
            });
          } catch (err) {
            console.error('Error processing chat notification:', err);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Chat notifications subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to chat notifications for user:', userId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to chat notifications. Check Supabase real-time is enabled for chat_messages table.');
          console.error('💡 Run this SQL in Supabase SQL Editor:');
          console.error('   ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;');
        } else if (status === 'TIMED_OUT') {
          console.warn('⏱️ Chat notifications subscription timed out. Retrying...');
        } else {
          console.warn('⚠️ Chat notifications subscription status:', status);
        }
      });

    return () => {
      mounted = false;
      console.log('🔌 Cleaning up chat notifications subscription');
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId, userRole]); // Remove openChatRequestId - use ref instead to prevent subscription recreation

  // Mark messages as read when chat is opened
  const markAsRead = useCallback(async (requestId: string) => {
    if (!userId) return;

    try {
      // Update all unread messages for this request where sender is NOT current user
      // (messages from others that we're reading)
      const { error } = await supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('request_id', requestId)
        .neq('sender_id', userId) // Messages from others
        .is('read_at', null);

      if (error) throw error;

      // Clear unread count for this chat
      setUnreadChats((prev) => {
        const newMap = new Map(prev);
        newMap.delete(requestId);
        return newMap;
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [userId]);

  const getUnreadCount = useCallback((requestId: string) => {
    return unreadChats.get(requestId)?.unreadCount || 0;
  }, [unreadChats]);

  const clearLatestNotification = useCallback(() => {
    setLatestNotification(null);
  }, []);

  return {
    unreadChats,
    getUnreadCount,
    markAsRead,
    openChatRequestId,
    setOpenChatRequestId,
    latestNotification,
    clearLatestNotification,
    totalUnreadCount: Array.from(unreadChats.values()).reduce((sum, chat) => sum + chat.unreadCount, 0)
  };
};

