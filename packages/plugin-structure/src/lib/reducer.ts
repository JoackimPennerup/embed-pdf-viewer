import { StructureAction, StructureState } from './types';

export const initialState: StructureState = {};

export function structureReducer(
  state: StructureState = initialState,
  action: StructureAction,
): StructureState {
  switch (action.type) {
    default:
      return state;
  }
}
