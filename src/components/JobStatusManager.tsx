import { useJobStatusMachine } from '@/hooks/useJobStatusMachine';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Navigation, MapPin, Wrench, Loader2 } from 'lucide-react';
import { getAvailableTransitions, canTransition } from '@/machines/jobStatusMachine';

interface JobStatusManagerProps {
  jobId: string;
  currentStatus: string;
  mechanicId?: string | null;
  userId?: string;
  onStatusChange?: (newStatus: string) => void;
  onAccept?: () => void;
  onReject?: () => void;
}

const JobStatusManager = ({
  jobId,
  currentStatus,
  mechanicId,
  userId,
  onStatusChange,
  onAccept,
  onReject,
}: JobStatusManagerProps) => {
  const {
    canAccept,
    canReject,
    canArrive,
    canStartRepair,
    canFinish,
    accept,
    reject,
    arrive,
    startRepair,
    finish,
    isLoading,
  } = useJobStatusMachine({
    jobId,
    initialStatus: currentStatus,
    mechanicId,
    userId,
    onStatusChange,
  });

  const availableTransitions = getAvailableTransitions(currentStatus);

  // If pending and can accept/reject
  if (currentStatus === 'pending' && mechanicId) {
    return (
      <div className="flex gap-2 w-full">
        <Button
          size="sm"
          onClick={() => {
            if (mechanicId) {
              accept(mechanicId);
              onAccept?.();
            }
          }}
          disabled={!canAccept || isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          Accept
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            reject();
            onReject?.();
          }}
          disabled={!canReject || isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4 mr-2" />
          )}
          Reject
        </Button>
      </div>
    );
  }

  // For other statuses, show dropdown with valid transitions only
  const getStatusOptions = () => {
    const allStatuses = [
      { value: 'accepted', label: 'Accepted', icon: CheckCircle },
      { value: 'on_the_way', label: 'On The Way', icon: Navigation },
      { value: 'reached_destination', label: 'Reached Destination', icon: MapPin },
      { value: 'repair_started', label: 'Repair Started', icon: Wrench },
      { value: 'repair_completed', label: 'Repair Completed', icon: CheckCircle },
      { value: 'completed', label: 'Completed', icon: CheckCircle },
    ];

    // Filter to show only valid transitions
    return allStatuses.filter(status => {
      if (status.value === currentStatus) return true; // Show current status
      return canTransition(currentStatus, status.value);
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    
    if (!canTransition(currentStatus, newStatus)) {
      console.warn(`Invalid transition from ${currentStatus} to ${newStatus}`);
      return;
    }

    // Map status values to actions based on current status and target
    // Since we already validated with canTransition, we can proceed with the action
    if (newStatus === 'on_the_way' && currentStatus === 'accepted') {
      // Transition from accepted to on_the_way
      arrive();
    } else if (newStatus === 'reached_destination' && currentStatus === 'on_the_way') {
      // Transition from on_the_way to reached_destination
      arrive();
    } else if (newStatus === 'repair_started') {
      // Transition to repair_started (can come from on_the_way or reached_destination)
      startRepair();
    } else if (newStatus === 'repair_completed' && currentStatus === 'repair_started') {
      // Transition from repair_started to repair_completed
      finish('repair_completed');
    } else if (newStatus === 'completed' && currentStatus === 'repair_completed') {
      // Transition from repair_completed to completed
      finish('completed');
    } else {
      // For other transitions, call onStatusChange directly
      if (onStatusChange) {
        onStatusChange(newStatus);
      }
    }
  };

  const options = getStatusOptions();

  if (options.length <= 1) {
    // Only current status available
    return (
      <div className="text-sm text-muted-foreground capitalize">
        {currentStatus.replace('_', ' ')}
      </div>
    );
  }

  return (
    <Select
      value={currentStatus}
      onValueChange={handleStatusChange}
      disabled={isLoading}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{option.label}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};

export default JobStatusManager;

