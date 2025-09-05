import { A11yAction, A11yState } from './types';

export const initialState: A11yState = {};

export function a11yReducer(state: A11yState = initialState, action: A11yAction): A11yState {
  switch (action.type) {
    default:
      return state;
  }
}
