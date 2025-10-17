import { RedactionItem, RedactionState } from './types';
import {
  RedactionAction,
  ADD_PENDING,
  CLEAR_PENDING,
  END_REDACTION,
  REMOVE_PENDING,
  START_REDACTION,
  SET_ACTIVE_TYPE,
  SELECT_PENDING,
  DESELECT_PENDING,
} from './actions';

// Helper function to calculate total pending count
const calculatePendingCount = (pending: Record<number, RedactionItem[]>): number => {
  return Object.values(pending).reduce((total, items) => total + items.length, 0);
};

export const initialState: RedactionState = {
  isRedacting: false,
  activeType: null,
  pending: {},
  pendingCount: 0,
  selected: null,
};

export const redactionReducer = (state = initialState, action: RedactionAction): RedactionState => {
  switch (action.type) {
    case ADD_PENDING: {
      const next = { ...state.pending };
      for (const item of action.payload) {
        next[item.page] = (next[item.page] ?? []).concat(item);
      }
      return { ...state, pending: next, pendingCount: calculatePendingCount(next) };
    }

    case REMOVE_PENDING: {
      const { page, id } = action.payload;
      const list = state.pending[page] ?? [];
      const filtered = list.filter((it) => it.id !== id);
      const next = { ...state.pending, [page]: filtered };

      // if the removed one was selected → clear selection
      const stillSelected =
        state.selected && !(state.selected.page === page && state.selected.id === id);

      return {
        ...state,
        pending: next,
        pendingCount: calculatePendingCount(next),
        selected: stillSelected ? state.selected : null,
      };
    }

    case CLEAR_PENDING:
      return { ...state, pending: {}, pendingCount: 0, selected: null };

    case SELECT_PENDING:
      return { ...state, selected: { page: action.payload.page, id: action.payload.id } };

    case DESELECT_PENDING:
      return { ...state, selected: null };

    case START_REDACTION:
      return { ...state, isRedacting: true, activeType: action.payload };
    case END_REDACTION:
      return {
        ...state,
        pending: {},
        pendingCount: 0,
        selected: null,
        isRedacting: false,
        activeType: null,
      };
    case SET_ACTIVE_TYPE:
      return { ...state, activeType: action.payload };
    default:
      return state;
  }
};
