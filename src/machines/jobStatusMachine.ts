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

const VALID_STATUSES = [
  'pending',
  'accepted',
  'on_the_way',
  'reached_destination',
  'repair_started',
  'repair_completed',
  'completed',
  'rejected',
  'cancelled',
] as const;

type JobStatusValue = (typeof VALID_STATUSES)[number];

const matchesStatus = (status: JobStatusValue) => {
  return (_: JobStatusContext, event: JobStatusEvent) => {
    if (event.type !== 'RESET') {
      return false;
    }
    const safeStatus = getInitialState(event.status);
    return safeStatus === status;
  };
};

const createResetTransitions = () =>
  VALID_STATUSES.map((status) => ({
    cond: matchesStatus(status),
    target: status,
    actions: assign({
      currentStatus: () => status,
    }),
  }));

export const jobStatusMachine = createMachine(
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
              mechanicId: (_, event) => {
                if (event && typeof event === 'object' && 'mechanicId' in event) {
                  return (event as { mechanicId: string }).mechanicId;
                }
                return null;
              },
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
      RESET: [
        ...createResetTransitions(),
        {
          target: 'pending',
          actions: assign({
            currentStatus: (_, event) => {
              if (!event || typeof event !== 'object' || !('type' in event)) {
                console.warn('RESET handler received invalid event', event);
                return 'pending';
              }
              if ((event as JobStatusEvent).type !== 'RESET') {
                console.warn('RESET handler received unexpected event', event);
              } else {
                console.warn('RESET event missing status property', event);
              }
              return 'pending';
            },
          }),
        },
      ],
    },
  },
  {
    actions: {
      // Additional actions can be added here
    },
  }
);

// Helper function to get the initial state based on current status
export const getInitialState = (status: string): JobStatusValue => {
  return VALID_STATUSES.includes(status as JobStatusValue) ? (status as JobStatusValue) : 'pending';
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

