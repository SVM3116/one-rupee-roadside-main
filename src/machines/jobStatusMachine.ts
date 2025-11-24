import { createMachine, assign } from 'xstate';

export interface JobStatusContext {
  jobId: string;
  currentStatus: string;
  mechanicId?: string | null;
  userId?: string;
  error?: string;
}

export type JobStatusEvent =
  | { type: 'ACCEPT'; mechanicId: string }
  | { type: 'REJECT' }
  | { type: 'ARRIVE' }
  | { type: 'START_REPAIR' }
  | { type: 'FINISH' }
  | { type: 'CANCEL' }
  | { type: 'RESET'; status: string };

export const jobStatusMachine = createMachine<JobStatusContext, JobStatusEvent>(
  {
    id: 'jobStatus',
    initial: 'pending',
    context: {
      jobId: '',
      currentStatus: 'pending',
      mechanicId: null,
      userId: undefined,
      error: undefined,
    },
    states: {
      pending: {
        on: {
          ACCEPT: {
            target: 'accepted',
            actions: assign({
              currentStatus: 'accepted',
              mechanicId: (_, event) => event.mechanicId,
            }),
          },
          REJECT: {
            target: 'rejected',
            actions: assign({
              currentStatus: 'rejected',
            }),
          },
          CANCEL: {
            target: 'cancelled',
            actions: assign({
              currentStatus: 'cancelled',
            }),
          },
        },
      },
      accepted: {
        on: {
          ARRIVE: {
            target: 'on_the_way',
            actions: assign({
              currentStatus: 'on_the_way',
            }),
          },
          REJECT: {
            target: 'rejected',
            actions: assign({
              currentStatus: 'rejected',
            }),
          },
          CANCEL: {
            target: 'cancelled',
            actions: assign({
              currentStatus: 'cancelled',
            }),
          },
        },
      },
      on_the_way: {
        on: {
          ARRIVE: {
            target: 'reached_destination',
            actions: assign({
              currentStatus: 'reached_destination',
            }),
          },
          START_REPAIR: {
            target: 'repair_started',
            actions: assign({
              currentStatus: 'repair_started',
            }),
          },
          CANCEL: {
            target: 'cancelled',
            actions: assign({
              currentStatus: 'cancelled',
            }),
          },
        },
      },
      reached_destination: {
        on: {
          START_REPAIR: {
            target: 'repair_started',
            actions: assign({
              currentStatus: 'repair_started',
            }),
          },
          CANCEL: {
            target: 'cancelled',
            actions: assign({
              currentStatus: 'cancelled',
            }),
          },
        },
      },
      repair_started: {
        on: {
          FINISH: {
            target: 'repair_completed',
            actions: assign({
              currentStatus: 'repair_completed',
            }),
          },
          CANCEL: {
            target: 'cancelled',
            actions: assign({
              currentStatus: 'cancelled',
            }),
          },
        },
      },
      repair_completed: {
        on: {
          FINISH: {
            target: 'completed',
            actions: assign({
              currentStatus: 'completed',
            }),
          },
        },
      },
      completed: {
        type: 'final',
      },
      rejected: {
        type: 'final',
      },
      cancelled: {
        type: 'final',
      },
    },
    on: {
      RESET: {
        actions: assign({
          currentStatus: (_, event) => {
            if (!event || typeof event !== 'object' || !('status' in event)) {
              console.warn('RESET event missing status property', event);
              return 'pending'; // Default to pending if event is invalid
            }
            return (event as any).status;
          },
        }),
      },
    },
  },
  {
    actions: {
      // Additional actions can be added here
    },
  }
);

// Helper function to get the initial state based on current status
export const getInitialState = (status: string): string => {
  const validStates = [
    'pending',
    'accepted',
    'on_the_way',
    'reached_destination',
    'repair_started',
    'repair_completed',
    'completed',
    'rejected',
    'cancelled',
  ];

  return validStates.includes(status) ? status : 'pending';
};

// Helper function to get available transitions for a status
export const getAvailableTransitions = (status: string): string[] => {
  const transitions: Record<string, string[]> = {
    pending: ['accepted', 'rejected', 'cancelled'],
    accepted: ['on_the_way', 'rejected', 'cancelled'],
    on_the_way: ['reached_destination', 'repair_started', 'cancelled'],
    reached_destination: ['repair_started', 'cancelled'],
    repair_started: ['repair_completed', 'cancelled'],
    repair_completed: ['completed'],
    completed: [],
    rejected: [],
    cancelled: [],
  };

  return transitions[status] || [];
};

// Helper function to check if a transition is valid
export const canTransition = (fromStatus: string, toStatus: string): boolean => {
  const available = getAvailableTransitions(fromStatus);
  return available.includes(toStatus);
};

