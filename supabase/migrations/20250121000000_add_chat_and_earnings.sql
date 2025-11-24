-- ============================================
-- MIGRATION: Add Chat, Earnings, Transactions, and Notifications
-- ============================================

-- Create chat_messages table for in-app chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.job_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'mechanic')),
  message TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create mechanic_earnings table
CREATE TABLE IF NOT EXISTS public.mechanic_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.job_requests(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  commission_rate DECIMAL(5, 2) DEFAULT 15.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_amount DECIMAL(10, 2) NOT NULL CHECK (commission_amount >= 0),
  net_amount DECIMAL(10, 2) NOT NULL CHECK (net_amount >= 0),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed')),
  payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table for wallet/history
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earning', 'payout', 'refund', 'bonus')),
  amount DECIMAL(10, 2) NOT NULL,
  balance_before DECIMAL(10, 2) NOT NULL DEFAULT 0,
  balance_after DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  reference_id UUID, -- References mechanic_earnings.id or other sources
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'mechanic_assigned',
    'mechanic_on_way',
    'job_completed',
    'request_accepted',
    'request_rejected',
    'verification_approved',
    'verification_rejected',
    'payment_received',
    'message_received'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}', -- Additional data (request_id, etc.)
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_locations table (if not exists from previous migration)
CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_request_id ON public.chat_messages(request_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_mechanic_earnings_mechanic_id ON public.mechanic_earnings(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_earnings_request_id ON public.mechanic_earnings(request_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_earnings_payment_status ON public.mechanic_earnings(payment_status);
CREATE INDEX IF NOT EXISTS idx_mechanic_earnings_created_at ON public.mechanic_earnings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_mechanic_id ON public.transactions(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_messages
DROP POLICY IF EXISTS "Users and mechanics can view their chat messages" ON public.chat_messages;
CREATE POLICY "Users and mechanics can view their chat messages"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.job_requests jr
      WHERE jr.id = chat_messages.request_id
      AND (jr.user_id = auth.uid() OR jr.mechanic_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users and mechanics can send chat messages" ON public.chat_messages;
CREATE POLICY "Users and mechanics can send chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_requests jr
      WHERE jr.id = chat_messages.request_id
      AND (jr.user_id = auth.uid() OR jr.mechanic_id = auth.uid())
    )
    AND sender_id = auth.uid()
  );

DROP POLICY IF EXISTS "Message sender can update their message" ON public.chat_messages;
CREATE POLICY "Message sender can update their message"
  ON public.chat_messages FOR UPDATE
  USING (sender_id = auth.uid());

-- RLS Policies for mechanic_earnings
DROP POLICY IF EXISTS "Mechanics can view their own earnings" ON public.mechanic_earnings;
CREATE POLICY "Mechanics can view their own earnings"
  ON public.mechanic_earnings FOR SELECT
  USING (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all earnings" ON public.mechanic_earnings;
CREATE POLICY "Admins can view all earnings"
  ON public.mechanic_earnings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "System can create earnings (via service role)" ON public.mechanic_earnings;
CREATE POLICY "System can create earnings (via service role)"
  ON public.mechanic_earnings FOR INSERT
  WITH CHECK (true); -- Managed by backend/triggers

DROP POLICY IF EXISTS "Admins can update earnings" ON public.mechanic_earnings;
CREATE POLICY "Admins can update earnings"
  ON public.mechanic_earnings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for transactions
DROP POLICY IF EXISTS "Mechanics can view their own transactions" ON public.transactions;
CREATE POLICY "Mechanics can view their own transactions"
  ON public.transactions FOR SELECT
  USING (mechanic_id = auth.uid());

DROP POLICY IF EXISTS "System can create transactions (via service role)" ON public.transactions;
CREATE POLICY "System can create transactions (via service role)"
  ON public.transactions FOR INSERT
  WITH CHECK (true); -- Managed by backend/triggers

-- RLS Policies for notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can create notifications (via service role)" ON public.notifications;
CREATE POLICY "System can create notifications (via service role)"
  ON public.notifications FOR INSERT
  WITH CHECK (true); -- Managed by backend/triggers

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies for user_locations
DROP POLICY IF EXISTS "Users can view their own location" ON public.user_locations;
CREATE POLICY "Users can view their own location"
  ON public.user_locations FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all user locations" ON public.user_locations;
CREATE POLICY "Admins can view all user locations"
  ON public.user_locations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can insert their own location" ON public.user_locations;
CREATE POLICY "Users can insert their own location"
  ON public.user_locations FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own location" ON public.user_locations;
CREATE POLICY "Users can update their own location"
  ON public.user_locations FOR UPDATE
  USING (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for mechanic_earnings
DROP TRIGGER IF EXISTS update_mechanic_earnings_updated_at ON public.mechanic_earnings;
CREATE TRIGGER update_mechanic_earnings_updated_at
  BEFORE UPDATE ON public.mechanic_earnings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

