import { Action } from '@embedpdf/core';
import { RedactionItem, RedactionMode } from './types';

export const START_REDACTION = 'START_REDACTION';
export const END_REDACTION = 'END_REDACTION';
export const SET_ACTIVE_TYPE = 'SET_ACTIVE_TYPE';

export const ADD_PENDING = 'ADD_PENDING';
export const REMOVE_PENDING = 'REMOVE_PENDING';
export const CLEAR_PENDING = 'CLEAR_PENDING';

export const SELECT_PENDING = 'SELECT_PENDING';
export const DESELECT_PENDING = 'DESELECT_PENDING';

export interface StartRedactionAction extends Action {
  type: typeof START_REDACTION;
  payload: RedactionMode;
}
export interface EndRedactionAction extends Action {
  type: typeof END_REDACTION;
}
export interface SetActiveTypeAction extends Action {
  type: typeof SET_ACTIVE_TYPE;
  payload: RedactionMode | null;
}

export interface AddPendingAction extends Action {
  type: typeof ADD_PENDING;
  payload: RedactionItem[];
}
export interface RemovePendingAction extends Action {
  type: typeof REMOVE_PENDING;
  payload: { page: number; id: string };
}
export interface ClearPendingAction extends Action {
  type: typeof CLEAR_PENDING;
}

export interface SelectPendingAction extends Action {
  type: typeof SELECT_PENDING;
  payload: { page: number; id: string };
}
export interface DeselectPendingAction extends Action {
  type: typeof DESELECT_PENDING;
}

export type RedactionAction =
  | StartRedactionAction
  | EndRedactionAction
  | SetActiveTypeAction
  | AddPendingAction
  | RemovePendingAction
  | ClearPendingAction
  | SelectPendingAction
  | DeselectPendingAction;

export const addPending = (items: RedactionItem[]): AddPendingAction => ({
  type: ADD_PENDING,
  payload: items,
});
export const removePending = (page: number, id: string): RemovePendingAction => ({
  type: REMOVE_PENDING,
  payload: { page, id },
});
export const clearPending = (): ClearPendingAction => ({ type: CLEAR_PENDING });

export const startRedaction = (mode: RedactionMode): StartRedactionAction => ({
  type: START_REDACTION,
  payload: mode,
});
export const endRedaction = (): EndRedactionAction => ({ type: END_REDACTION });
export const setActiveType = (mode: RedactionMode | null): SetActiveTypeAction => ({
  type: SET_ACTIVE_TYPE,
  payload: mode,
});

export const selectPending = (page: number, id: string): SelectPendingAction => ({
  type: SELECT_PENDING,
  payload: { page, id },
});
export const deselectPending = (): DeselectPendingAction => ({ type: DESELECT_PENDING });
