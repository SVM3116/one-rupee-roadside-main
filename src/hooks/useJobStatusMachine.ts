import { useMachine } from '@xstate/react';
import { useEffect } from 'react';
import { jobStatusMachine, getInitialState, JobStatusContext, JobStatusEvent } from '@/machines/jobStatusMachine';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseJobStatusMachineProps {
  jobId: string;
  initialStatus: string;
  mechanicId?: string | null;
  userId?: string;
  onStatusChange?: (newStatus: string) => void;
}

export const useJobStatusMachine = ({
  jobId,
  initialStatus,
  mechanicId,
  userId,
  onStatusChange,
}: UseJobStatusMachineProps) => {
  const { toast } = useToast();
  const [state, send, service] = useMachine(jobStatusMachine, {
    context: {
      jobId,
      currentStatus: initialStatus,
      mechanicId,
      userId,
    },
  });

  // Reset machine when initial status changes - but avoid infinite loops
  useEffect(() => {
    if (!initialStatus) {
      return;
    }

    const currentState = getInitialState(initialStatus);
    // Only reset if status actually changed and we have a valid state
    if (currentState && currentState !== state.context.currentStatus) {
      try {
        // Ensure we send a valid RESET event with status property
        const resetEvent: JobStatusEvent = { type: 'RESET', status: currentState };
        send(resetEvent);
      } catch (error) {
        // Ignore reset errors - machine might already be in correct state
        console.warn('Machine reset warning:', error);
      }
    }
  }, [initialStatus, state.context.currentStatus, send]);

  // Listen for state changes
  useEffect(() => {
    const subscription = service.subscribe((currentState) => {
      if (onStatusChange && currentState.context.currentStatus !== initialStatus) {
        onStatusChange(currentState.context.currentStatus);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, initialStatus]);

  // Transition functions that update the database
  const transitionStatus = async (event: JobStatusEvent, targetStatus: string) => {
    try {
      const updateData: any = {
        status: targetStatus,
        updated_at: new Date().toISOString(),
      };

      // If accepting, update mechanic_id
      if (event.type === 'ACCEPT') {
        updateData.mechanic_id = event.mechanicId;
      }

      // If rejecting, remove mechanic_id and set back to pending
      if (event.type === 'REJECT') {
        updateData.mechanic_id = null;
        updateData.status = 'pending'; // Reassign to another mechanic
      }

      const { error } = await supabase
        .from('job_requests')
        .update(updateData)
        .eq('id', jobId);

      if (error) throw error;

      // Send the event to the machine
      send(event);

      // Refresh the job list will be handled by parent component
      if (onStatusChange) {
        onStatusChange(targetStatus);
      }

      const statusLabels: Record<string, string> = {
        accepted: 'Job accepted',
        rejected: 'Job rejected',
        on_the_way: 'On the way to customer',
        reached_destination: 'Reached customer location',
        repair_started: 'Repair started',
        repair_completed: 'Repair completed',
        completed: 'Job completed',
        cancelled: 'Job cancelled',
      };

      toast({
        title: 'Success',
        description: statusLabels[targetStatus] || `Job status updated to ${targetStatus.replace('_', ' ')}`,
      });
    } catch (error: any) {
      console.error('Error updating job status:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update job status',
        variant: 'destructive',
      });
    }
  };

  const accept = (mechanicId: string) => {
    transitionStatus({ type: 'ACCEPT', mechanicId }, 'accepted');
  };

  const reject = () => {
    transitionStatus({ type: 'REJECT' }, 'rejected');
  };

  const arrive = () => {
    // Determine target status based on current state
    // Use state.value (current machine state) instead of context for accuracy
    const currentState = state.value as string;
    let targetStatus = 'reached_destination';
    
    // From accepted -> on_the_way
    // From on_the_way -> reached_destination
    if (currentState === 'accepted') {
      targetStatus = 'on_the_way';
    } else if (currentState === 'on_the_way') {
      targetStatus = 'reached_destination';
    } else {
      // Fallback: use context if state doesn't match expected values
      const currentStatus = state.context.currentStatus || initialStatus;
      if (currentStatus === 'accepted') {
        targetStatus = 'on_the_way';
      }
    }
    
    transitionStatus({ type: 'ARRIVE' }, targetStatus);
  };

  const startRepair = () => {
    transitionStatus({ type: 'START_REPAIR' }, 'repair_started');
  };

  const finish = (targetStatus?: string) => {
    // Use targetStatus if provided, otherwise determine from current state
    if (targetStatus) {
      transitionStatus({ type: 'FINISH' }, targetStatus);
      return;
    }
    
    // Fallback: determine target status from current state/context
    const currentState = state.value as string;
    const currentStatus = state.context.currentStatus || initialStatus;
    
    // Check state first, then context, then initialStatus
    let finalCurrentStatus = currentState;
    if (!finalCurrentStatus || finalCurrentStatus === 'pending') {
      finalCurrentStatus = currentStatus;
    }
    
    if (finalCurrentStatus === 'repair_started') {
      transitionStatus({ type: 'FINISH' }, 'repair_completed');
    } else if (finalCurrentStatus === 'repair_completed') {
      transitionStatus({ type: 'FINISH' }, 'completed');
    } else {
      // Fallback: use initialStatus to determine
      if (initialStatus === 'repair_started') {
        transitionStatus({ type: 'FINISH' }, 'repair_completed');
      } else if (initialStatus === 'repair_completed') {
        transitionStatus({ type: 'FINISH' }, 'completed');
      }
    }
  };

  const cancel = () => {
    transitionStatus({ type: 'CANCEL' }, 'cancelled');
  };

  return {
    state: state.value as string,
    context: state.context,
    canAccept: state.can({ type: 'ACCEPT' } as JobStatusEvent),
    canReject: state.can({ type: 'REJECT' } as JobStatusEvent),
    canArrive: state.can({ type: 'ARRIVE' } as JobStatusEvent),
    canStartRepair: state.can({ type: 'START_REPAIR' } as JobStatusEvent),
    canFinish: state.can({ type: 'FINISH' } as JobStatusEvent),
    canCancel: state.can({ type: 'CANCEL' } as JobStatusEvent),
    accept,
    reject,
    arrive,
    startRepair,
    finish,
    cancel,
    isLoading: state.hasTag('loading'),
  };
};

